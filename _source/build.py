#!/usr/bin/env python3
"""Build the public static pages from one set of templates and locale catalogs."""

import argparse
from collections import Counter
from dataclasses import dataclass, field
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit, urlunsplit
import xml.etree.ElementTree as ET

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parent
ORIGIN = "https://philia17.github.io"
LANGUAGES = {
    "en": ("en", "en_GB", "English"),
    "zh": ("zh-Hant", "zh_TW", "繁體中文"),
    "fr": ("fr", "fr_FR", "Français"),
    "ja": ("ja", "ja_JP", "日本語"),
    "ko": ("ko", "ko_KR", "한국어"),
}
VOID_TAGS = set("area base br col embed hr img input link meta param source track wbr".split())
INLINE = set("a abbr b br cite code em i small span strong sub sup".split())
TEXT_META = {"description", "og:title", "og:description", "og:image:alt", "twitter:title", "twitter:description"}
MARKER = re.compile(r"<(/?)([1-9][0-9]*)(/?)>")
MATERIAL_EXTENSIONS = {".pdf", ".bib", ".pptx"}
ASSET_VERSION = "20261112-languages"
SITEMAP = "http://www.sitemaps.org/schemas/sitemap/0.9"
XHTML = "http://www.w3.org/1999/xhtml"

UI = {
    "ui.language": "Language",
    "ui.english-material": "English",
}
PAPER_TITLES = {
    "Robot–Elevator Interaction: From Physical Panel Recognition to Activation",
    "A Test and Training Platform Utilizing a Raspberry Pi 5: AI-Retrieval, Tools and a Compact LLM",
    "Bangbang V2: On-Device Facial Emotion and Bilingual Speech Recognition for a Raspberry Pi-Based Tele-Operated Avatar Robot",
    "Bangbang 2.0: Human-in-the-Loop Edge-Cloud LLM Decision Support for Inclusive Service Robots",
}
INVARIANT = PAPER_TITLES | {
    "Siheng Ye", "葉嗣恒", "EEE · UNNC", "LinkedIn", "GitHub", "ORCID", "BibTeX", "LEKSI",
    "Bangbang V2", "IHCI", "HRFEST", "2026 / 105", "2026 / 106", "2026 / 230", "2026 / 99",
    "University of Nottingham Ningbo China", "AI + Design Thinking & Robothon 2026",
    "© 2026 Siheng Ye", "葉嗣恒 <1/> Siheng Ye",
    "Siheng Ye · Xiaotong Li · Chang Qi · Linfei Yin · Yaokun Zhang · Ian Pratt",
    "Siheng Ye · Zejing Tong · Suiyi Zhang · David Chieng",
    "Younghoon Chang · Siheng Ye · Yuechen Cao · Yanjie Zhou · Changshuai Liu · Hoe Yin Khong · Yuhong Dai · David Chieng · Christian Fernando Libaque-Saenz",
    "Younghoon Chang · Yanjie Zhou · Changshuai Liu · Siheng Ye · Yuechen Cao · Hoe Yin Khong · Yuhong Dai · David Chieng",
    "Yanjie Zhou · Siheng Ye · Xinyan Pan · Yitao Liu",
    "Siheng Ye · Tangyi Wang · Xiaotong Li · Xinyan Pan",
    "Angrong Liu · Siheng Ye · Zican Huang",
}


@dataclass
class Element:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)


class PageParser(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.root = Element("")
        self.stack = [self.root]
        self.feed(html)
        self.close()
        if len(self.stack) != 1:
            raise ValueError(f"Unclosed element {self.stack[-1].tag}")

    def handle_starttag(self, tag, attrs):
        node = Element(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.stack[-1].tag != tag:
            raise ValueError(f"Expected </{self.stack[-1].tag}>, found </{tag}>")
        self.stack.pop()

    def handle_data(self, data):
        self.stack[-1].children.append(data)

    def handle_decl(self, declaration):
        self.stack[-1].children.append(Element("!doctype", {"value": declaration}))

    def handle_comment(self, comment):
        self.stack[-1].children.append(Element("!comment", {"value": comment}))


def route(filename):
    return "/" + filename.as_posix().removesuffix("index.html")


def localized_path(path, lang):
    return path if lang == "en" else f"/{lang}{path}"


def local_url(url, lang, pages):
    parts = urlsplit(url)
    if parts.netloc not in ("", urlsplit(ORIGIN).netloc) or parts.path not in pages:
        return url
    return urlunsplit(parts._replace(path=localized_path(parts.path, lang)))


def has_words(value):
    return any(character.isalpha() for character in MARKER.sub("", value))


def marker_signature(value):
    return Counter(MARKER.findall(value))


class Catalog:
    def __init__(self, previous):
        self.entries = dict(UI)
        self.by_source = {}
        self.previous = {value: key for key, value in previous.items() if key not in UI}
        self.used = set(previous) | set(UI)
        self.counts = Counter()

    def key(self, value, scope):
        value = value.strip()
        if not has_words(value) or value in INVARIANT or re.fullmatch(r"EEEE\d+|[ABCD] / [A-Z]|SS\d+|IEB \d+", value):
            return None
        if value in self.by_source:
            return self.by_source[value]

        key = self.previous.get(value)
        if key is None:
            while True:
                self.counts[scope] += 1
                key = f"{scope}.{self.counts[scope]:03}"
                if key not in self.used:
                    break
        self.used.add(key)
        self.by_source[value] = key
        self.entries[key] = value
        return key


def tokens(element):
    """Keep one translation per sentence/block, with numbered markup boundaries."""
    elements = {}

    def collect(children):
        text = []
        for child in children:
            if isinstance(child, str):
                text.append(child)
                continue
            if child.tag not in INLINE:
                return None
            number = len(elements) + 1
            elements[number] = child
            if child.tag == "br" or child.attrs.get("aria-hidden") == "true":
                text.append(f"<{number}/>")
                continue
            content = collect(child.children)
            if content is None:
                return None
            text.append(f"<{number}>{content}</{number}>")
        return "".join(text)

    return collect(element.children), elements


def groups(node):
    """Keep sibling labels separate when a container has no continuous prose."""
    if node.tag in {"title", "p", "li", "summary", "h1", "h2", "h3", "h4", "h5", "h6", "em", "strong", "figcaption", "dt", "dd"}:
        return True
    return any(isinstance(child, str) and has_words(child) for child in node.children)


class Renderer:
    def __init__(self, catalog, locale, path, lang, pages):
        self.catalog = catalog
        self.locale = locale
        self.path = path
        self.page = slug(path)
        self.lang = lang
        self.pages = pages

    def message(self, value, scope):
        key = self.catalog.key(value, scope)
        if key and self.locale is not None:
            stripped = value.strip()
            return value.replace(stripped, self.locale[key], 1)
        return value

    def scope(self, previous, node):
        if node.tag in {"head", "header", "footer"}:
            return f"{self.page}.{node.tag}"
        if node.attrs.get("id") not in (None, "top", "main"):
            return f"{self.page}.{node.attrs['id']}"
        return previous

    def attrs(self, node, scope):
        attrs = dict(node.attrs)
        for key in ("aria-label", "alt", "title"):
            if attrs.get(key):
                attrs[key] = self.message(attrs[key], f"{scope}.{key}")
        if node.tag == "meta" and (attrs.get("name") in TEXT_META or attrs.get("property") in TEXT_META):
            attrs["content"] = self.message(attrs["content"], f"{scope}.meta")
        return attrs

    def start(self, tag, attrs):
        attr_text = "".join(
            f' {key}="{escape(value, quote=True)}"' if value is not None else f" {key}"
            for key, value in attrs.items()
        )
        return f"<{tag}{attr_text}>"

    def inline(self, value, elements, scope):
        output = []
        previous = 0
        stack = []
        for match in MARKER.finditer(value):
            output.append(escape(value[previous:match.start()], quote=False))
            close, number, single = match.groups()
            element = elements[int(number)]
            if single:
                output.append(self.element(element, scope))
            elif close:
                if not stack or stack.pop() != number:
                    raise ValueError(f"Unbalanced inline marker in {self.lang}: {value}")
                output.append(self.link_note(element))
                output.append(f"</{element.tag}>")
            else:
                stack.append(number)
                output.append(self.start(element.tag, self.localized_attrs(element, scope)))
            previous = match.end()
        if stack:
            raise ValueError(f"Unclosed inline marker in {self.lang}: {value}")
        output.append(escape(value[previous:], quote=False))
        return "".join(output)

    def is_material_link(self, node):
        if node.tag != "a" or not node.attrs.get("href"):
            return False
        target = urlsplit(node.attrs["href"])
        return target.netloc in ("", urlsplit(ORIGIN).netloc) and Path(target.path).suffix in MATERIAL_EXTENSIONS

    def link_note(self, node):
        if not self.locale or self.lang == "en" or not self.is_material_link(node):
            return ""
        has_image = any(isinstance(child, Element) and child.tag == "img" for child in node.children)
        if has_image and node.attrs.get("aria-label"):
            return ""
        css_class = "visually-hidden" if has_image else "material-language"
        label = escape(self.locale["ui.english-material"])
        return f' <span class="{css_class}">({label})</span>'

    def localized_attrs(self, node, scope):
        attrs = self.attrs(node, scope)
        if node.tag == "html":
            attrs["lang"] = LANGUAGES[self.lang][0]
        if attrs.get("href"):
            attrs["href"] = local_url(attrs["href"], self.lang, self.pages)
            if urlsplit(attrs["href"]).path == "/styles.css":
                attrs["href"] = f"/styles.css?v={ASSET_VERSION}"
        if node.tag == "meta" and attrs.get("property") == "og:url":
            attrs["content"] = local_url(attrs["content"], self.lang, self.pages)
        if self.lang != "en":
            for name in ("href", "src", "poster"):
                if attrs.get(name) and not attrs[name].startswith("#"):
                    parts = urlsplit(attrs[name])
                    if not parts.scheme and not parts.netloc and parts.path and not parts.path.startswith("/"):
                        attrs[name] = urljoin(ORIGIN + self.path, attrs[name]).removeprefix(ORIGIN)
            if self.is_material_link(node):
                attrs["hreflang"] = "en"
                if self.locale and attrs.get("aria-label"):
                    attrs["aria-label"] += f" ({self.locale['ui.english-material']})"
        return attrs

    def extra(self, node):
        if not self.locale:
            return ""
        if node.tag == "head":
            lines = ["", *alternate_links(self.path)]
            lines.append(f'<meta property="og:locale" content="{LANGUAGES[self.lang][1]}">')
            for lang, (_, og_locale, _) in LANGUAGES.items():
                if lang != self.lang:
                    lines.append(f'<meta property="og:locale:alternate" content="{og_locale}">')
            lines.append(f'<script src="/language-switch.js?v={ASSET_VERSION}" defer></script>')
            return "\n".join(lines) + "\n"
        if node.tag == "header" and node.attrs.get("class") == "masthead":
            label = escape(self.locale["ui.language"], quote=True)
            links = []
            for lang, (tag, _, name) in LANGUAGES.items():
                href = localized_path(self.path, lang)
                current = ' aria-current="page"' if lang == self.lang else ""
                links.append(f'<a href="{href}" lang="{tag}" hreflang="{tag}" data-language-link{current}>{name}</a>')
            return f'\n<nav class="language-nav" aria-label="{label}">{"".join(links)}</nav>\n'
        return ""

    def element(self, node, scope):
        if isinstance(node, str):
            return escape(self.message(node, scope), quote=False)
        if node.tag == "!doctype":
            return "<!doctype html>"
        if node.tag == "!comment":
            return f"<!--{node.attrs['value']}-->"
        scope = self.scope(scope, node)
        attrs = self.localized_attrs(node, scope)
        if node.tag in VOID_TAGS:
            return self.start(node.tag, attrs)
        if node.tag == "script":
            content = "".join(node.children)
            if attrs.get("type") == "application/ld+json":
                content = self.structured_data(content, f"{scope}.jsonld")
        else:
            value, elements = tokens(node) if groups(node) else (None, {})
            if value is not None and has_words(value):
                if value.strip() in PAPER_TITLES and self.lang != "en":
                    attrs.setdefault("lang", "en")
                content = self.inline(self.message(value, scope), elements, scope)
            else:
                content = "".join(self.element(child, scope) for child in node.children)
        if not node.tag:
            return content
        extra = self.extra(node)
        if extra:
            content = content.rstrip() + extra
        return self.start(node.tag, attrs) + content + self.link_note(node) + f"</{node.tag}>"

    def structured_data(self, source, scope):
        data = json.loads(source)
        if "name" in data:
            data["name"] = self.message(data["name"], scope)
        person = data.get("mainEntity", {})
        if isinstance(person, dict) and "description" in person:
            person["description"] = self.message(person["description"], scope)
        if self.lang == "en":
            return source
        if "url" in data:
            data["url"] = local_url(data["url"], self.lang, self.pages)
        data["inLanguage"] = LANGUAGES[self.lang][0]
        return json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")


def alternates(path):
    return {
        **{tag: ORIGIN + localized_path(path, lang) for lang, (tag, _, _) in LANGUAGES.items()},
        "x-default": ORIGIN + path,
    }


def alternate_links(path):
    return [
        f'<link rel="alternate" hreflang="{tag}" href="{url}">'
        for tag, url in alternates(path).items()
    ]


def source_pages():
    return {
        route(filename.relative_to(SOURCE / "templates").with_suffix("")): PageParser(filename.read_text(encoding="utf-8")).root
        for filename in sorted((SOURCE / "templates").rglob("*.html.in"))
    }


def catalog_for(pages):
    filename = SOURCE / "locales/en.json"
    previous = json.loads(filename.read_text(encoding="utf-8")) if filename.exists() else {}
    catalog = Catalog(previous)
    for path, template in sorted(pages.items()):
        Renderer(catalog, None, path, "en", pages).element(template, slug(path))
    return catalog


def slug(path):
    return path.strip("/").split("/")[-1].removesuffix(".html") or "home"


def write_catalog(catalog):
    path = SOURCE / "locales/en.json"
    path.write_text(json.dumps(catalog.entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def locale_from_file(lang, catalog):
    filename = SOURCE / f"locales/{lang}.json"
    locale = json.loads(filename.read_text(encoding="utf-8"))
    missing = catalog.entries.keys() - locale.keys()
    extra = locale.keys() - catalog.entries.keys()
    if missing or extra:
        raise ValueError(f"{lang}: missing keys {sorted(missing)}; extra keys {sorted(extra)}")
    for key, source in catalog.entries.items():
        value = locale[key]
        if not isinstance(value, str) or not value.strip() or marker_signature(source) != marker_signature(value):
            raise ValueError(f"{lang}: empty translation or changed inline markers for {key}")
        for title in PAPER_TITLES:
            if title in source and title not in value:
                raise ValueError(f"{lang}: official paper title changed in {key}")
    if lang == "en" and locale != catalog.entries:
        raise ValueError("English catalog is stale. Run --catalog and reconcile the locale catalogs.")
    return locale


def filename_for(path):
    return ROOT / (path.lstrip("/") + ("index.html" if path.endswith("/") else ""))


def build_sitemap():
    ET.register_namespace("", SITEMAP)
    ET.register_namespace("xhtml", XHTML)
    source_urls = ET.parse(SOURCE / "sitemap.xml").getroot()
    sitemap = ET.Element(f"{{{SITEMAP}}}urlset")
    for entry in source_urls:
        path = urlsplit(entry.findtext(f"{{{SITEMAP}}}loc")).path
        lastmod = entry.findtext(f"{{{SITEMAP}}}lastmod")
        for lang in LANGUAGES:
            url = ET.SubElement(sitemap, f"{{{SITEMAP}}}url")
            ET.SubElement(url, f"{{{SITEMAP}}}loc").text = ORIGIN + localized_path(path, lang)
            ET.SubElement(url, f"{{{SITEMAP}}}lastmod").text = lastmod
            for tag, href in alternates(path).items():
                ET.SubElement(url, f"{{{XHTML}}}link", rel="alternate", hreflang=tag, href=href)
    ET.indent(sitemap)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(sitemap, encoding="unicode") + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", action="store_true", help="refresh the English locale catalog")
    parser.add_argument("--check", action="store_true", help="check that the published pages match the source")
    parser.add_argument("--language", choices=LANGUAGES, help="build or check only one language")
    args = parser.parse_args()
    pages = source_pages()
    catalog = catalog_for(pages)
    if args.catalog:
        write_catalog(catalog)
        print(f"{len(catalog.entries)} messages across {len(pages)} pages")
        return

    outputs = {}
    for lang in [args.language] if args.language else LANGUAGES:
        locale = locale_from_file(lang, catalog)
        for path, template in pages.items():
            renderer = Renderer(catalog, locale, path, lang, pages)
            outputs[filename_for(localized_path(path, lang))] = renderer.element(template, slug(path)).rstrip() + "\n"
    if not args.language:
        outputs[ROOT / "sitemap.xml"] = build_sitemap()
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, source in outputs.items() if not path.exists() or path.read_text(encoding="utf-8") != source]
        if stale:
            raise ValueError(f"Generated output is stale: {', '.join(stale)}")
    else:
        for path, source in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(source, encoding="utf-8")
    print(f"{'Checked' if args.check else 'Built'} {len(outputs)} files")


if __name__ == "__main__":
    main()
