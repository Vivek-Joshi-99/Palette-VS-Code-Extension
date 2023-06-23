import * as vscode from "vscode";
import * as shelljs from "shelljs";
import { ChildProcess } from "child_process";

export class Wizard {
  public static currentPanel: Wizard | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebViewContent("Intro") as string;
    this._setWebviewMessageListener(this._panel.webview);
  }

  public static render() {
    if (Wizard.currentPanel) {
      Wizard.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        "webview",
        "Create a New Palette Virtual Cluster",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        }
      );
      Wizard.currentPanel = new Wizard(panel);
    }
  }

  public dispose() {
    Wizard.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        let command = message.command as string;
        const data = message.data;
        console.log(command, data);
        switch (command) {
          case "Login":
            this.paletteLogin(data);
            command = "Wait";
            break;
          case "Settings":
            this.paletteCreateCluster(data);
            break;
        }
        console.log(command);
        webview.html = this._getWebViewContent(command) as string;
      },
      undefined,
      this._disposables
    );
  }

  private getScript(sendingStep: string): string {
    return `
        <script>
            const vscode = acquireVsCodeApi();
            window.addEventListener("load", main);
    
            let data = [];

            function main() {
                const btn = document.getElementById("btn");
                btn?.addEventListener("click", handleClick);
            }

            function handleClick() {
                const form = document.getElementById("form");
                if(form){
                    for(let i=0;i<form.elements.length;i++)
                    {
                        data.push(form.elements[i].value);
                    }
                }

                vscode.postMessage({
                  command: "${sendingStep}",
                  data: data,
                });
              }
        </script>
    `;
  }

  private _getWebViewContent(sendingStep: string) {
    switch (sendingStep) {
      case "Intro":
        return this.getIntroPage();
      case "Hello":
        return this.getLoginPage();
      case "LoginSuccess":
        vscode.window.showInformationMessage("Login successful");
        return this.getSettingsPage();
      case "LoginFailed":
        vscode.window.showInformationMessage(
          "Login unsuccessful. Please try again"
        );
        return this.getLoginPage();
      case "creationSuccess":
        vscode.window.showInformationMessage("Virtual cluster created!");
        return "<p>DONE</p>"
        //return this.getSettingsPage();
      case "creationFailed":
        vscode.window.showInformationMessage(
          "Creation unsuccessful. Please try Again"
        );
        return this.getSettingsPage();
      case "Wait":
        return "<p>LOADING</p>";
      default:
        return "<h1>Internal Error</h1>";
    }
  }
  private getErrorPage() {
    const html = `
    <p>Login Unsuccessful </p>
    <p>Please try to login again! </p>
    `;
    return this.getHTMLContent(html, "Login");
  }

  private getIntroPage() {
    const html = `
    <p>Welcome to the Palette Virtual Cluster Creation Wizard</p>
    <p>Prerequisistes: </p> 
    <ol>
        <li>Palette CLI</li> 
        <li>Official VS Code Kubernetes Extension</li>
    </ol> 
    `;
    return this.getHTMLContent(html, "Hello");
  }

  private getLoginPage() {
    const html = `
    <h1>Enter Your Palette Credentials</h1>
    <form id="form">
        <p>Palette API Key: <input type='text' name='' value='' /></p>
        <p>Login URL: <input type='text' name='' value='' /></p>
        <p>Active Project: <input type='text' name='' valur='Default' /></p>
    </form>
    `;
    return this.getHTMLContent(html, "Login");
  }

  private getSettingsPage() {
    const html = `
    <h1>Enter your virtual cluster config</h1>
    <form id="form">
        <p>Virtual cluster name: <input type='text' name='' /></p>
        <p>Cluster CPU: <input type='number' name='' /></p>
        <p>Cluster Memory: <input type='number' name='' /></p>
        <p>Cluster Storage: <input type='number' name='' /></p>
        <p>Cluster Group (Default Beehive): <input type='text' name='' /></p>
    </form>
    `;
    return this.getHTMLContent(html, "Settings");
  }

  private getHTMLContent(htmlbody: string, sendingStep: string) {
    return `
    <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Create a New Palette Virtual Cluster</title>
        </head>
        <body>
            ${this.getScript(sendingStep)}
            ${htmlbody}
            <button id="btn">Continue</button>
        </body>
      </html>

    `;
  }

  private paletteLogin(data: Array<string>) {
    // shelljs.config.execPath = shelljs.which('node');
    const childProcess = shelljs.exec(
      `palette pde login --api-key ${data[0]} --console-url ${data[1]} --project ${data[2]}`,
      { async: true }
    ) as ChildProcess;
    childProcess.on("exit", (code: number) => {
      if (code == 1) {
        console.log(childProcess.stdout);
        this._panel.webview.html = this._getWebViewContent("LoginFailed");
      } else if (code == 0) {
        this._panel.webview.html = this._getWebViewContent("LoginSuccess");
      }
    });
  }

  private paletteCreateCluster(data: Array<string>) {
    const childProcess = shelljs.exec(
      `palette pde virtual-cluster create --cluster-group-name ${data[4]} --cluster-group-scope system --cpu ${data[1]} --memory ${data[2]} --name ${data[0]} --storage ${data[3]}`,
      { async: true }
    ) as ChildProcess;
    childProcess.on("exit", (code: number) => {
      if (code == 1) {
        console.log(childProcess.stdout);
        this._panel.webview.html = this._getWebViewContent("creationFailed");
      } else if (code == 0) {
        this._panel.webview.html = this._getWebViewContent("creationSuccess");
      }
    });
  }
}
