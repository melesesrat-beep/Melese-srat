const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Find the start of the first handlePrintAuditReport signature
const startIndex = content.indexOf('const handlePrintAuditReport = (');
if (startIndex === -1) {
  console.log("ERROR: Could not find handlePrintAuditReport signature");
  process.exit(1);
}

// Find the '  // Filter logs logic' comment which comes right after the first print report block
const filterLogsIndex = content.indexOf('  // Filter logs logic', startIndex);
if (filterLogsIndex === -1) {
  console.log("ERROR: Could not find Filter logs logic comment");
  process.exit(1);
}

// Find the closing brace index of the print report function
const partToReplace = content.substring(startIndex, filterLogsIndex);
const lastBraceIndex = partToReplace.lastIndexOf('};');
if (lastBraceIndex === -1) {
  console.log("ERROR: Could not find ending of handlePrintAuditReport");
  process.exit(1);
}

const endOfPrintReportIndex = startIndex + lastBraceIndex + 2;

// The block to replace starts from the comment '// Modern Audit Report Printing Helper' just before startIndex
let startReplaceIndex = content.lastIndexOf('// Modern Audit Report Printing Helper', startIndex);
if (startReplaceIndex === -1) {
  startReplaceIndex = startIndex;
}

const replacementForSmsGateway = `
        if (response.ok && data.success) {
          gatewaySuccess = true;
          gatewayResultLog = \`ጌትዌይ መልስ: \${data.detail || "መልዕክት በተሳካ ሁኔታ ተልኳል!"}\`;
          alert(\`የኤስኤምኤስ ሙከራ ስኬታማ ነው! \${gatewayResultLog}\`);
        } else {
          gatewaySuccess = false;
          gatewayResultLog = data.error || \`የጌትዌይ ምላሽ አልተሳካም (Status \${response.status}).\`;
          alert(\`የኤስኤምኤስ ሙከራ አልተሳካም: \${gatewayResultLog}\`);
        }
      } catch (err: any) {
        gatewaySuccess = false;
        gatewayResultLog = \`ኔትወርክ ስህተት: \${err.message || err}\`;
        alert(\`ኔትወርክ ስህተት አጋጥሟል: \${gatewayResultLog}\`);
      }
    } else {
      // Simulation mode
      gatewaySuccess = true;
      gatewayResultLog = "የማስመሰል ሁኔታ (Simulation Mode) ነቅቷል። (የኤስኤምኤስ ጌትዌይ በቅንብሮች ውስጥ አልበራም)። መልዕክቱ እንደተላከ ተቆጥሯል።";
      alert(gatewayResultLog);
    }

    logAuditAction('የኤስኤምኤስ መሞከሪያ (Test SMS Connection)', \`ባለሙያው የኤስኤምኤስ ሙከራ ለስልክ [\${cleanPhone}] አድርጓል። ውጤት: \${gatewaySuccess ? 'የተሳካ' : 'ያልተሳካ'} - \${gatewayResultLog}\`);
    setIsTestingSms(false);
  };

`;

content = content.substring(0, startReplaceIndex) + replacementForSmsGateway + content.substring(endOfPrintReportIndex);
console.log("Replaced the first handlePrintAuditReport with SMS test completion logic.");

// Now remove the second duplicate block starting at '  }; filteredForm011 = form011.filter(row => {'
const dupStartStr = '  }; filteredForm011 = form011.filter(row => {';
const dupStartIndex = content.indexOf(dupStartStr);
if (dupStartIndex === -1) {
  console.log("WARNING: Could not find duplicate filteredForm011 block, maybe already removed.");
} else {
  // Find the end of this duplicate triggerReport, which is right before '  // Modern Audit Report Printing Helper'
  const nextReportIndex = content.indexOf('  // Modern Audit Report Printing Helper', dupStartIndex);
  if (nextReportIndex === -1) {
    console.log("ERROR: Could not find the end of duplicate triggerReport");
    process.exit(1);
  } else {
    const closeBraceIndex = content.lastIndexOf('};', nextReportIndex);
    if (closeBraceIndex !== -1 && closeBraceIndex > dupStartIndex) {
      content = content.substring(0, dupStartIndex) + content.substring(closeBraceIndex + 2);
      console.log("Successfully removed duplicate triggerReport block.");
    } else {
      console.log("ERROR: Invalid closing brace for duplicate block.");
      process.exit(1);
    }
  }
}

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log("SUCCESS: Programmatic fix of src/App.tsx complete!");
