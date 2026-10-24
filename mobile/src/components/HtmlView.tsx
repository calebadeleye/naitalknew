import { useMemo, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "../state/theme";
import { openLink } from "../lib/links";

/**
 * An email body, sandboxed: the server has already cleaned the HTML; here a
 * Content-Security-Policy blocks every script, frame and form in it, and
 * remote images unless the reader allowed them (trackers report opens).
 * Links open in the browser, never inside the reader.
 */
export function emailDocument(html: string, opts: { allowRemoteImages: boolean; dark: boolean }): string {
  const img = opts.allowRemoteImages ? "data: cid: https: http:" : "data: cid:";
  const csp = `default-src 'none'; img-src ${img}; style-src 'unsafe-inline'; font-src data:; media-src data:`;
  const darkCss = opts.dark ? "html{background:#111a2b} body{filter:invert(1) hue-rotate(180deg);background:#fff} img,video{filter:invert(1) hue-rotate(180deg)}" : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank">
<style>html,body{margin:0;padding:0}body{font-family:-apple-system,Roboto,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#0f172a;padding:4px 16px 16px;word-wrap:break-word;overflow-wrap:anywhere}img{max-width:100%!important;height:auto!important}table{max-width:100%!important}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #cbd5e1;color:#475569}pre{white-space:pre-wrap}a{color:#15803d}${darkCss}</style></head><body>${html}</body></html>`;
}

// Reports the content height so the WebView can sit inside the reader's scroll view.
const MEASURE = `(function(){function post(){window.ReactNativeWebView.postMessage(String(Math.ceil(document.documentElement.scrollHeight)))}
window.addEventListener('load',post);new ResizeObserver(post).observe(document.body);setTimeout(post,50);setTimeout(post,600)})();true;`;

export function HtmlView({ html, allowRemoteImages }: { html: string; allowRemoteImages: boolean }): React.ReactElement {
  const { dark } = useTheme();
  const [height, setHeight] = useState(120);
  const source = useMemo(() => ({ html: emailDocument(html, { allowRemoteImages, dark }), baseUrl: "" }), [html, allowRemoteImages, dark]);

  if (Platform.OS === "web") {
    // Development preview in a browser only.
    return <iframe title="Email" sandbox="" srcDoc={source.html} style={{ border: 0, width: "100%", minHeight: 400 }} />;
  }

  return (
    <View style={{ height }}>
      <WebView
        originWhitelist={["about:*"]}
        source={source}
        injectedJavaScript={MEASURE}
        onMessage={(e: WebViewMessageEvent): void => {
          const h = Number(e.nativeEvent.data);
          if (h > 0) setHeight(Math.min(h + 8, 40000));
        }}
        onShouldStartLoadWithRequest={(request: { url: string }): boolean => {
          if (request.url.startsWith("about:") || request.url.startsWith("data:")) return true;
          if (/^https?:/i.test(request.url)) openLink(request.url);
          else if (/^(mailto|tel):/i.test(request.url)) void Linking.openURL(request.url);
          return false;
        }}
        scrollEnabled={false}
        javaScriptEnabled
        allowFileAccess={false}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        mixedContentMode="never"
        style={{ backgroundColor: "transparent" }}
      />
    </View>
  );
}
