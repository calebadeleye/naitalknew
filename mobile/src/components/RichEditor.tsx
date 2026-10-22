import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, TextInput } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "../state/theme";

/**
 * The message body editor: a contenteditable page in a WebView (the same
 * HTML the web composer produces). The toolbar runs editing commands in it;
 * every change is posted back as HTML.
 */
export type RichEditorHandle = { command: (name: string, value?: string) => void; insertHtml: (html: string) => void; setHtml: (html: string) => void; focus: () => void };

function page(initialHtml: string, placeholder: string, dark: boolean): string {
  const fg = dark ? "#e5e7eb" : "#0f172a";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'">
<style>html,body{margin:0;background:transparent}#e{min-height:260px;outline:none;padding:12px 16px 40px;font:16px/1.5 -apple-system,Roboto,sans-serif;color:${fg};word-wrap:break-word}
#e:empty:before{content:attr(data-placeholder);color:#94a3b8}img{max-width:100%}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #cbd5e1;color:#64748b}a{color:#16a34a}</style></head>
<body><div id="e" contenteditable="true" data-placeholder="${placeholder.replace(/"/g, "&quot;")}">${initialHtml}</div></body></html>`;
}

const BRIDGE = `(function(){var e=document.getElementById('e');var t;function post(){clearTimeout(t);t=setTimeout(function(){window.ReactNativeWebView.postMessage(e.innerHTML)},150)}
e.addEventListener('input',post);window.__gm={cmd:function(n,v){e.focus();document.execCommand(n,false,v||null);post()},html:function(h){e.focus();document.execCommand('insertHTML',false,h);post()},set:function(h){e.innerHTML=h;post()},focus:function(){e.focus()}};})();true;`;

type Props = { initialHtml: string; placeholder?: string; onChange: (html: string) => void };

export const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor({ initialHtml, placeholder = "Type your message here…", onChange }, ref) {
  const { colors, dark } = useTheme();
  const web = useRef<WebView<object>>(null);
  // Loaded once; later changes go through commands so the cursor isn't lost.
  const source = useMemo(() => ({ html: page(initialHtml, placeholder, dark) }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = (js: string) => web.current?.injectJavaScript(`${js};true;`);
  useImperativeHandle(ref, () => ({
    command: (name, value) => run(`window.__gm.cmd(${JSON.stringify(name)},${JSON.stringify(value ?? null)})`),
    insertHtml: (html) => run(`window.__gm.html(${JSON.stringify(html)})`),
    setHtml: (html) => run(`window.__gm.set(${JSON.stringify(html)})`),
    focus: () => run("window.__gm.focus()"),
  }));

  if (Platform.OS === "web") {
    // Browser preview only: plain text box.
    return <TextInput multiline defaultValue={initialHtml.replace(/<[^>]+>/g, "")} placeholder={placeholder} onChangeText={(t) => onChange(`<p>${t.replace(/\n/g, "<br>")}</p>`)} style={{ minHeight: 260, padding: 16, color: colors.text, fontSize: 16 }} />;
  }

  return (
    <WebView
      ref={web}
      originWhitelist={["about:*"]}
      source={source}
      injectedJavaScript={BRIDGE}
      onMessage={(e: WebViewMessageEvent) => onChange(e.nativeEvent.data)}
      onShouldStartLoadWithRequest={(r: { url: string }) => r.url.startsWith("about:")}
      hideKeyboardAccessoryView
      keyboardDisplayRequiresUserAction={false}
      style={{ flex: 1, minHeight: 280, backgroundColor: "transparent" }}
      javaScriptEnabled
    />
  );
});
