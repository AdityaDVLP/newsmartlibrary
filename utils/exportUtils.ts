"use client";

export interface ExportColumn {
  header: string;
  key: string;
  formatter?: (value: any, row: any) => string;
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * 1. EXPORT CSV (.csv)
 * Formats CSV with UTF-8 BOM byte sequence (\uFEFF) for seamless Microsoft Excel rendering
 */
export const exportToCSV = (
  filename: string,
  title: string,
  columns: ExportColumn[],
  data: any[]
) => {
  let csvContent = "\uFEFF"; // UTF-8 BOM

  // Header row
  const headerRow = columns
    .map((col) => `"${col.header.replace(/"/g, '""')}"`)
    .join(",");
  csvContent += headerRow + "\r\n";

  // Data rows
  data.forEach((item) => {
    const row = columns
      .map((col) => {
        let val = item[col.key];
        if (col.formatter) {
          val = col.formatter(val, item);
        }
        if (val === null || val === undefined) val = "";
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      })
      .join(",");
    csvContent += row + "\r\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
};

/**
 * 2. EXPORT EXCEL XLSX (.xlsx)
 * Generates Microsoft Excel SpreadsheetML XML format with blue headers and custom styling
 */
export const exportToXLSX = (
  filename: string,
  title: string,
  columns: ExportColumn[],
  data: any[]
) => {
  const currentDate = new Date().toLocaleString("id-ID");

  const xmlRows = data
    .map((item, idx) => {
      const cells = columns
        .map((col) => {
          let val = item[col.key];
          if (col.formatter) {
            val = col.formatter(val, item);
          }
          if (val === null || val === undefined) val = "";
          const strVal = String(val)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
          return `<Cell ss:StyleID="${idx % 2 === 0 ? "EvenRow" : "OddRow"}"><Data ss:Type="String">${strVal}</Data></Cell>`;
        })
        .join("");
      return `<Row ss:Height="22">${cells}</Row>`;
    })
    .join("");

  const headerCells = columns
    .map(
      (col) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${col.header
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</Data></Cell>`
    )
    .join("");

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Smart Library ITK</Author>
  <Created>${new Date().toISOString()}</Created>
  <Title>${title}</Title>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#1E3A8A"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E40AF" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E3A8A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E3A8A"/>
   </Borders>
  </Style>
  <Style ss:ID="EvenRow">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="OddRow">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Laporan Data">
  <Table ss:ExpandedColumnCount="${columns.length}" ss:ExpandedRowCount="${data.length + 4}" x:FullColumns="1" x:FullRows="1" ss:DefaultColumnWidth="140" ss:DefaultRowHeight="20">
   <Row ss:Height="30">
    <Cell ss:StyleID="Title"><Data ss:Type="String">${title.toUpperCase()} - ITK SMART LIBRARY</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:StyleID="Subtitle"><Data ss:Type="String">Tanggal Ekspor: ${currentDate} | Total Baris: ${data.length} Data</Data></Cell>
   </Row>
   <Row ss:Height="6"/>
   <Row ss:Height="26">${headerCells}</Row>
   ${xmlRows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Header x:Margin="0.3"/>
    <Footer x:Margin="0.3"/>
    <PageMargins x:Bottom="0.75" x:Left="0.7" x:Right="0.7" x:Top="0.75"/>
   </PageSetup>
   <Selected/>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
};

/**
 * 3. EXPORT PDF (.pdf)
 * Opens formatted printable document window with ITK Smart Library header, table styling, and auto-print
 */
export const exportToPDF = (
  filename: string,
  title: string,
  columns: ExportColumn[],
  data: any[]
) => {
  const currentDate = new Date().toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "medium",
  });

  const tableHeaders = columns
    .map(
      (col) =>
        `<th style="padding: 10px 12px; background-color: #1e40af; color: #ffffff; font-size: 11px; text-align: left; text-transform: uppercase; border-bottom: 2px solid #1e3a8a;">${col.header}</th>`
    )
    .join("");

  const tableRows = data
    .map((item, idx) => {
      const cells = columns
        .map((col) => {
          let val = item[col.key];
          if (col.formatter) {
            val = col.formatter(val, item);
          }
          if (val === null || val === undefined) val = "-";
          return `<td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b;">${val}</td>`;
        })
        .join("");
      const bg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
      return `<tr style="background-color: ${bg};">${cells}</tr>`;
    })
    .join("");

  const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>${title} - ITK Smart Library</title>
  <meta charset="utf-8" />
  <style>
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 15mm 15mm 15mm;
      }
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #ffffff;
    }
    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px double #1e40af;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .logo-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-badge {
      background: linear-gradient(135deg, #1e40af, #3b82f6);
      color: #ffffff;
      font-weight: 900;
      font-size: 18px;
      padding: 8px 14px;
      border-radius: 10px;
      letter-spacing: 1px;
    }
    .title-text h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .title-text p {
      margin: 4px 0 0 0;
      font-size: 12px;
      color: #64748b;
    }
    .meta-badge {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .meta-badge strong {
      color: #1e40af;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    .footer-stamp {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 11px;
      color: #64748b;
      page-break-inside: avoid;
    }
    .signature-box {
      text-align: center;
      width: 200px;
    }
    .signature-line {
      margin-top: 60px;
      border-bottom: 1px solid #94a3b8;
      font-weight: bold;
      color: #0f172a;
      padding-bottom: 4px;
    }
    .action-bar {
      margin-bottom: 20px;
      padding: 12px 16px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .btn-print {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <span>💡 <strong>Petunjuk Simpan PDF:</strong> Klik tombol <strong>"Cetak / Simpan PDF"</strong>, lalu pilih destination <strong>"Save as PDF"</strong> pada dialog browser.</span>
    <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>

  <div class="header-container">
    <div class="logo-title">
      <div class="logo-badge">ITK</div>
      <div class="title-text">
        <h1>${title}</h1>
        <p>Institut Teknologi Kalimantan — Smart Library Management System</p>
      </div>
    </div>
    <div class="meta-badge">
      <div>Tanggal Cetak: <strong>${currentDate}</strong></div>
      <div>Jumlah Data: <strong>${data.length} Rekaman</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${tableHeaders}</tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer-stamp">
    <div>
      <p>Laporan ini dihasilkan secara otomatis oleh sistem <strong>ITK Smart Library RFID Engine</strong>.</p>
    </div>
    <div class="signature-box">
      <p>Petugas Perpustakaan,</p>
      <div class="signature-line">( Staf Administrasi RFID )</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }
};

/**
 * 4. EXPORT BSON (.bson)
 * Pure Binary JSON serializer compliant with BSON document specification (MongoDB compatible)
 */
function encodeBsonString(key: string, val: string): Uint8Array {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  const valBytes = encoder.encode(val);

  const valLength = valBytes.length + 1; // including null byte
  const totalElemLen = 1 + keyBytes.length + 1 + 4 + valBytes.length + 1;

  const buffer = new Uint8Array(totalElemLen);
  let pos = 0;

  buffer[pos++] = 0x02; // Type String
  buffer.set(keyBytes, pos);
  pos += keyBytes.length;
  buffer[pos++] = 0x00; // Key null terminator

  // Int32 length little-endian
  buffer[pos++] = valLength & 0xff;
  buffer[pos++] = (valLength >> 8) & 0xff;
  buffer[pos++] = (valLength >> 16) & 0xff;
  buffer[pos++] = (valLength >> 24) & 0xff;

  buffer.set(valBytes, pos);
  pos += valBytes.length;
  buffer[pos++] = 0x00; // Val null terminator

  return buffer;
}

function encodeBsonDocument(doc: Record<string, any>): Uint8Array {
  const elemBuffers: Uint8Array[] = [];
  let totalElemBytes = 0;

  for (const [key, val] of Object.entries(doc)) {
    let strVal: string;
    if (typeof val === "object" && val !== null) {
      strVal = JSON.stringify(val);
    } else if (val === null || val === undefined) {
      strVal = "";
    } else {
      strVal = String(val);
    }
    const elemBuf = encodeBsonString(key, strVal);
    elemBuffers.push(elemBuf);
    totalElemBytes += elemBuf.length;
  }

  const docSize = 4 + totalElemBytes + 1; // 4 (size) + elements + 1 (null terminator)
  const docBuffer = new Uint8Array(docSize);
  let pos = 0;

  docBuffer[pos++] = docSize & 0xff;
  docBuffer[pos++] = (docSize >> 8) & 0xff;
  docBuffer[pos++] = (docSize >> 16) & 0xff;
  docBuffer[pos++] = (docSize >> 24) & 0xff;

  for (const elemBuf of elemBuffers) {
    docBuffer.set(elemBuf, pos);
    pos += elemBuf.length;
  }

  docBuffer[pos++] = 0x00; // Document null terminator
  return docBuffer;
}

export const exportToBSON = (
  filename: string,
  title: string,
  columns: ExportColumn[],
  data: any[]
) => {
  const docBuffers: Uint8Array[] = [];

  data.forEach((item) => {
    const formattedObj: Record<string, any> = {};
    columns.forEach((col) => {
      let val = item[col.key];
      if (col.formatter) {
        val = col.formatter(val, item);
      }
      formattedObj[col.key] = val !== undefined ? val : "";
    });
    docBuffers.push(encodeBsonDocument(formattedObj));
  });

  const totalSize = docBuffers.reduce((sum, buf) => sum + buf.length, 0);
  const bsonSequence = new Uint8Array(totalSize);
  let offset = 0;
  for (const buf of docBuffers) {
    bsonSequence.set(buf, offset);
    offset += buf.length;
  }

  const blob = new Blob([bsonSequence], { type: "application/bson" });
  downloadBlob(blob, filename.endsWith(".bson") ? filename : `${filename}.bson`);
};
