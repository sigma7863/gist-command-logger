#!/usr/bin/env node
import {
  cmdAuth,
  cmdDoctor,
  cmdHelp,
  cmdInit,
  cmdInstallScriptPowershell,
  cmdInstallScriptUnix,
  cmdRecordFinish,
  cmdRunUpload,
  cmdStatus
} from "./commands.js";

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const rest = args.slice(1);

  try {
    switch (cmd) {
      case "init":
        cmdInit(rest);
        break;
      case "status":
        cmdStatus();
        break;
      case "auth":
        cmdAuth(rest);
        break;
      case "run-upload":
        cmdRunUpload();
        break;
      case "record-finish":
        cmdRecordFinish(rest);
        break;
      case "install-script-unix":
        cmdInstallScriptUnix();
        break;
      case "install-script-powershell":
        cmdInstallScriptPowershell();
        break;
      case "doctor":
        cmdDoctor();
        break;
      case "help":
      case "--help":
      case "-h":
      case undefined:
        cmdHelp();
        break;
      default:
        console.error(`Unknown command: ${cmd}`);
        cmdHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

main();
