import { describe, expect, it } from "vitest";

import { isSafeUrl, sanitizeHtml, stripHtml } from "./html";

describe("sanitizeHtml", () => {
  it("conserva el formato permitido", () => {
    const html = '<h2 id="x">Hola</h2><p>Texto <strong>fuerte</strong> y <a href="/productos">link</a></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("elimina scripts, estilos e iframes con su contenido", () => {
    expect(sanitizeHtml('<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe><p>b</p>')).toBe(
      "<p>a</p><p>b</p>",
    );
  });

  it("saca handlers y atributos no permitidos", () => {
    expect(sanitizeHtml('<img src="/a.png" onerror="alert(1)" style="x">')).toBe('<img src="/a.png">');
  });

  it("bloquea URLs javascript: aunque vengan ofuscadas", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeHtml('<a href="jav&#x09;ascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(isSafeUrl(" JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html;base64,xx")).toBe(false);
    expect(isSafeUrl("https://ok.com")).toBe(true);
  });

  it("agrega rel seguro a target=_blank", () => {
    expect(sanitizeHtml('<a href="https://x.com" target="_blank" rel="opener">x</a>')).toBe(
      '<a href="https://x.com" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });

  it("escapa texto suelto y cierra tags abiertos", () => {
    expect(sanitizeHtml("<p>1 < 2 & <b>ok")).toBe("<p>1 &lt; 2 &amp; <b>ok</b></p>");
  });

  it("quita tags desconocidos pero conserva su texto", () => {
    expect(sanitizeHtml("<marquee>hola</marquee><!-- c -->")).toBe("hola");
  });

  it("stripHtml devuelve texto plano", () => {
    expect(stripHtml("<p>Hola&nbsp;<b>mundo</b></p><p>chau</p>")).toBe("Hola mundo\nchau");
  });
});
