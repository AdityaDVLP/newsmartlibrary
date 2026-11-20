using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using Microsoft.Win32;

internal static class Program
{
    private const string ServiceName = "NewSmartLibraryUHFRFID";
    private const string PythonVersion = "3.14.10";
    private const string PythonUrl = "https://www.python.org/ftp/python/3.14.10/python-3.14.10-amd64.exe";
    private const string PythonSha256 = "92480239264744fe0386a1bd8275786fefa126e3129e56a68e22b52c73329965";
    private const string NssmUrl = "https://nssm.cc/ci/nssm-2.24-101-g897c7ad.zip";
    private const string NssmSha256 = "99F5045FFFBFFB745D67FE3A065A953C4A3D9C253B868892D9B685B0EE7D07B8";

    private static int Main()
    {
        Console.Title = "New Smart Library - UHF RFID Server Installer";
        Console.WriteLine("=======================================================");
        Console.WriteLine("  New Smart Library - UHF RFID Server Installer");
        Console.WriteLine("  (Auto-Start Windows Service - Plug & Play)");
        Console.WriteLine("=======================================================");
        Console.WriteLine("Hak Administrator diperlukan.\r\n");

        try
        {
            Install();
            Console.WriteLine("\r\n=======================================================");
            Console.WriteLine("  INSTALASI SELESAI & BERHASIL!");
            Console.WriteLine("  Service UHF RFID aktif dan otomatis nyala saat Windows booting.");
            Console.WriteLine("  WebSocket Server : ws://localhost:8765");
            Console.WriteLine("  HTTP API Status  : http://localhost:5001/api/rfid/status");
            Console.WriteLine("=======================================================");
            Console.WriteLine("\r\nTekan Enter untuk menutup.");
            Console.ReadLine();
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine("\r\nInstalasi gagal:");
            Console.Error.WriteLine(exception.Message);
            Console.Error.WriteLine("\r\nTekan Enter untuk menutup.");
            Console.ReadLine();
            return 1;
        }
    }

    private static void Install()
    {
        if (!Environment.Is64BitOperatingSystem ||
            !String.Equals(Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE"), "AMD64", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Installer ini memerlukan Windows 64-bit (x64).");
        }

        WindowsIdentity identity = WindowsIdentity.GetCurrent();
        WindowsPrincipal principal = new WindowsPrincipal(identity);
        if (!principal.IsInRole(WindowsBuiltInRole.Administrator))
        {
            throw new InvalidOperationException("Jalankan installer dengan memilih Run as administrator.");
        }

        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;

        string dataDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "NewSmartLibraryUHFRFID");
        string installDirectory = Path.Combine(dataDirectory, "App");
        string pythonDirectory = Path.Combine(installDirectory, "Python");
        string pythonExecutable = Path.Combine(pythonDirectory, "python.exe");
        string serverPath = Path.Combine(installDirectory, "rfid_ws_server.py");
        string nssmExecutable = Path.Combine(installDirectory, "nssm.exe");
        string logsDirectory = Path.Combine(dataDirectory, "Logs");
        string temporaryDirectory = Path.Combine(Path.GetTempPath(), "NewSmartLibraryUHFRFIDSetup");

        Directory.CreateDirectory(installDirectory);
        Directory.CreateDirectory(logsDirectory);
        Directory.CreateDirectory(temporaryDirectory);

        string pythonInstaller = Path.Combine(temporaryDirectory, "python-" + PythonVersion + "-amd64.exe");
        string nssmArchive = Path.Combine(temporaryDirectory, "nssm.zip");

        try
        {
            WriteStep("Mengekstrak file program UHF RFID...");
            using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("NewSmartLibraryUHFRFID.app.zip"))
            {
                if (stream == null)
                {
                    throw new InvalidOperationException("File arsip server UHF RFID tidak ditemukan di dalam installer.");
                }

                using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        string destFile = Path.Combine(installDirectory, entry.FullName);
                        entry.ExtractToFile(destFile, true);
                    }
                }
            }

            // Cek apakah Python sudah ada di HF RFID installer sebelumnya
            string existingHfPython = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "NewSmartLibraryRFID", "App", "Python", "python.exe");

            if (File.Exists(existingHfPython))
            {
                pythonExecutable = existingHfPython;
                WriteStep("Menggunakan instalasi Python yang sudah ada: " + pythonExecutable);
            }
            else if (!File.Exists(pythonExecutable))
            {
                pythonExecutable = FindRegisteredPython();
                if (pythonExecutable == null || !File.Exists(pythonExecutable))
                {
                    pythonExecutable = Path.Combine(pythonDirectory, "python.exe");
                    WriteStep("Mengunduh Python " + PythonVersion + "...");
                    DownloadAndVerify(PythonUrl, pythonInstaller, PythonSha256);

                    WriteStep("Memasang Python...");
                    int pythonInstallExitCode = RunProcess(
                        pythonInstaller,
                        "/quiet InstallAllUsers=1 TargetDir=\"" + pythonDirectory +
                        "\" Include_pip=1 Include_launcher=0 Include_test=0",
                        true);

                    if (!File.Exists(pythonExecutable))
                    {
                        pythonExecutable = FindRegisteredPython();
                        if (pythonExecutable == null)
                        {
                            throw new InvalidOperationException(
                                "Installer Python selesai dengan kode " + pythonInstallExitCode +
                                ", tetapi python.exe tidak ditemukan.");
                        }
                    }
                }
                else
                {
                    WriteStep("Python ditemukan di lokasi terdaftar: " + pythonExecutable);
                }
            }

            // Cek NSSM
            string existingNssm = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "NewSmartLibraryRFID", "App", "nssm.exe");

            if (File.Exists(existingNssm) && !File.Exists(nssmExecutable))
            {
                File.Copy(existingNssm, nssmExecutable, true);
            }
            else if (!File.Exists(nssmExecutable))
            {
                WriteStep("Mengunduh NSSM Service Manager...");
                DownloadAndVerify(NssmUrl, nssmArchive, NssmSha256);
                ExtractNssm(nssmArchive, nssmExecutable);
            }

            WriteStep("Memasang dependensi UHF RFID (pyserial, websockets)...");
            RunProcess(
                pythonExecutable,
                "-m pip install --disable-pip-version-check pyserial websockets",
                true);

            WriteStep("Mendaftarkan Windows Service otomatis...");
            ConfigureService(
                nssmExecutable,
                pythonExecutable,
                serverPath,
                logsDirectory);

            WriteStep("Menjalankan service UHF RFID...");
            RunProcess(nssmExecutable, "start " + ServiceName, false);
            WaitForApi();
        }
        finally
        {
            TryDelete(pythonInstaller);
            TryDelete(nssmArchive);
            TryDeleteDirectory(temporaryDirectory);
        }
    }

    private static string FindRegisteredPython()
    {
        string[] registryPaths = new string[]
        {
            @"SOFTWARE\Python\PythonCore\3.14\InstallPath",
            @"SOFTWARE\WOW6432Node\Python\PythonCore\3.14\InstallPath",
            @"SOFTWARE\Python\PythonCore\3.12\InstallPath",
            @"SOFTWARE\Python\PythonCore\3.11\InstallPath"
        };

        foreach (string registryPath in registryPaths)
        {
            using (RegistryKey key = Registry.LocalMachine.OpenSubKey(registryPath))
            {
                if (key == null)
                {
                    continue;
                }

                string executablePath = key.GetValue("ExecutablePath") as string;
                if (!String.IsNullOrEmpty(executablePath) && File.Exists(executablePath))
                {
                    return executablePath;
                }

                string installPath = key.GetValue(null) as string;
                if (!String.IsNullOrEmpty(installPath))
                {
                    string candidate = Path.Combine(installPath, "python.exe");
                    if (File.Exists(candidate))
                    {
                        return candidate;
                    }
                }
            }
        }

        return null;
    }

    private static void ConfigureService(
        string nssmExecutable,
        string pythonExecutable,
        string serverPath,
        string logsDirectory)
    {
        string serviceRegistryPath = @"SYSTEM\CurrentControlSet\Services\" + ServiceName;
        bool serviceExists;
        using (RegistryKey serviceKey = Registry.LocalMachine.OpenSubKey(serviceRegistryPath))
        {
            serviceExists = serviceKey != null;
        }

        if (serviceExists)
        {
            RunProcess(nssmExecutable, "stop " + ServiceName, false);
            RunProcess(nssmExecutable, "set " + ServiceName + " Application " + Quote(pythonExecutable), true);
            RunProcess(nssmExecutable, "set " + ServiceName + " AppParameters " + Quote(serverPath), true);
            RunProcess(nssmExecutable, "set " + ServiceName + " AppDirectory " + Quote(Path.GetDirectoryName(serverPath)), true);
        }
        else
        {
            RunProcess(
                nssmExecutable,
                "install " + ServiceName + " " + Quote(pythonExecutable) + " " + Quote(serverPath),
                true);
        }

        RunProcess(nssmExecutable, "set " + ServiceName + " AppDirectory " + Quote(Path.GetDirectoryName(serverPath)), true);
        RunProcess(nssmExecutable, "set " + ServiceName + " AppEnvironmentExtra PYTHONIOENCODING=utf-8", true);
        RunProcess(nssmExecutable, "set " + ServiceName + " Start SERVICE_AUTO_START", true);
        RunProcess(nssmExecutable, "set " + ServiceName + " AppExit Default Restart", true);
        RunProcess(nssmExecutable, "set " + ServiceName + " AppStdout " +
            Quote(Path.Combine(logsDirectory, "uhf-out.log")), true);
        RunProcess(nssmExecutable, "set " + ServiceName + " AppStderr " +
            Quote(Path.Combine(logsDirectory, "uhf-error.log")), true);
        RunProcess(nssmExecutable, "set " + ServiceName + " AppRotateFiles 1", true);
        RunProcess(nssmExecutable, "set " + ServiceName + " AppRotateOnline 1", true);
        RunProcess(nssmExecutable, "set " + ServiceName + " AppRotateBytes 1048576", true);
    }

    private static void DownloadAndVerify(string url, string destination, string expectedHash)
    {
        using (WebClient client = new WebClient())
        {
            client.Headers[HttpRequestHeader.UserAgent] = "NewSmartLibrary-UHFRFID-Installer";
            client.DownloadFile(url, destination);
        }

        string actualHash;
        using (SHA256 sha256 = SHA256.Create())
        using (FileStream file = File.OpenRead(destination))
        {
            actualHash = BitConverter.ToString(sha256.ComputeHash(file)).Replace("-", "");
        }

        if (!String.Equals(actualHash, expectedHash, StringComparison.OrdinalIgnoreCase))
        {
            TryDelete(destination);
            throw new InvalidOperationException("Verifikasi file unduhan gagal.");
        }
    }

    private static void ExtractNssm(string archivePath, string destination)
    {
        using (FileStream file = File.OpenRead(archivePath))
        using (ZipArchive archive = new ZipArchive(file, ZipArchiveMode.Read))
        {
            ZipArchiveEntry entry = null;
            foreach (ZipArchiveEntry candidate in archive.Entries)
            {
                if (candidate.FullName.EndsWith("/win64/nssm.exe", StringComparison.OrdinalIgnoreCase))
                {
                    entry = candidate;
                    break;
                }
            }

            if (entry == null)
            {
                throw new InvalidOperationException("File NSSM x64 tidak ditemukan di paket unduhan.");
            }

            using (Stream input = entry.Open())
            using (FileStream output = File.Create(destination))
            {
                input.CopyTo(output);
            }
        }
    }

    private static void WaitForApi()
    {
        Uri statusUrl = new Uri("http://127.0.0.1:5001/api/rfid/status");
        for (int attempt = 0; attempt < 20; attempt++)
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(statusUrl);
                request.Timeout = 1500;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    if ((int)response.StatusCode >= 200 && (int)response.StatusCode < 300)
                    {
                        return;
                    }
                }
            }
            catch (WebException)
            {
                System.Threading.Thread.Sleep(1000);
            }
        }
    }

    private static int RunProcess(string executable, string arguments, bool requireSuccess)
    {
        ProcessStartInfo startInfo = new ProcessStartInfo();
        startInfo.FileName = executable;
        startInfo.Arguments = arguments;
        startInfo.UseShellExecute = false;
        startInfo.CreateNoWindow = true;
        startInfo.RedirectStandardOutput = true;
        startInfo.RedirectStandardError = true;

        using (Process process = new Process())
        {
            process.StartInfo = startInfo;
            StringBuilder output = new StringBuilder();
            process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
            {
                if (eventArgs.Data != null)
                {
                    output.AppendLine(eventArgs.Data);
                }
            };
            process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
            {
                if (eventArgs.Data != null)
                {
                    output.AppendLine(eventArgs.Data);
                }
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            process.WaitForExit();

            if (requireSuccess && process.ExitCode != 0)
            {
                throw new InvalidOperationException(
                    Path.GetFileName(executable) + " gagal (kode " + process.ExitCode + "). " +
                    output.ToString().Trim());
            }

            return process.ExitCode;
        }
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    private static void WriteStep(string message)
    {
        Console.WriteLine(">> " + message);
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch (Exception)
        {
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path))
            {
                Directory.Delete(path, true);
            }
        }
        catch (Exception)
        {
        }
    }
}
