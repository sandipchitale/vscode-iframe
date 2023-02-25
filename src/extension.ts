import * as express from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import * as vscode from 'vscode';

const port = 7654;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-webview-iframe.start', () => {
      WebsitePanel.createOrShow(context.extensionUri);
    })
  );

  const app = express();

  app.use(function (req, res, next) {
    if (req.url.startsWith('/starter.zip')) {
      console.log(`**************************${req.url}`);
      res.status(200).end();
      return;
    }
    // when done, call next()
    next();
});

  app.use('/**',
    createProxyMiddleware({
      target: 'https://start.spring.io/',
      changeOrigin: true,
      followRedirects: true,
      // onProxyReq: (proxyReq, req, res) => {
      //   if (req.url.startsWith('/starter.zip')) {
      //     console.log(`**************************${req.url}`);
      //     res.status(200).end();
      //   }
      // },
      onProxyRes: (proxyRes, req, res) => {
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['X-Frame-Options'];
        delete proxyRes.headers['content-security-policy'];
        delete proxyRes.headers['Content-Security-Policy'];
      }
    })
  );

  app.listen(port, () => {
    console.log(`Proxy listening at http://localhost:${port}`);
  });
}

/**
 * Manages Spring Initializr webview panel
 */
class WebsitePanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: WebsitePanel | undefined;

  public static readonly viewType = 'webview-iframe';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    // If we already have a panel, show it.
    if (WebsitePanel.currentPanel) {
      WebsitePanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      WebsitePanel.viewType,
      'Webview iframe',
      column || vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,
        retainContextWhenHidden: true,

        // And restrict the webview to only loading content from our extension's `media` directory and https://google.com/
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.parse(`http://localhost:${port}/`),
          vscode.Uri.parse('https://google.com/')
        ]
      }
    );

    WebsitePanel.currentPanel = new WebsitePanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    WebsitePanel.currentPanel = new WebsitePanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose() {
    WebsitePanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-webview-iframe.css');
    // Uri to load styles into webview
    const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${stylesMainUri}" rel="stylesheet">
  <title>Webview iframe</title>
</head>
<body>
  <iframe id="webview-iframe" src="http://localhost:${port}/"></iframe>
</body>
</html>
`;
  }
}
