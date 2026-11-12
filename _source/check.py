#!/usr/bin/env python3
"""Verify generated page metadata, navigation, anchors and asset targets."""

from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET

from build import (
    Element, LANGUAGES, MATERIAL_EXTENSIONS, ORIGIN, PageParser, ROOT, SITEMAP,
    SOURCE, XHTML, alternates, filename_for, localized_path, source_pages,
)


def elements(node):
    if isinstance(node, Element):
        yield node
        for child in node.children:
            yield from elements(child)


def text(node):
    return node if isinstance(node, str) else "".join(map(text, node.children))


def hrefs(nodes, path):
    for node in nodes:
        if "data-language-link" in node.attrs:
            continue
        for attr in ("href", "src", "poster"):
            if node.attrs.get(attr):
                yield node.tag, attr, urlsplit(urljoin(ORIGIN + path, node.attrs[attr]))
        for source in node.attrs.get("srcset", "").split(","):
            if source.strip():
                yield node.tag, "srcset", urlsplit(urljoin(ORIGIN + path, source.split()[0]))


def retained_body(node):
    """Compare the English page to the source after excluding the new language menu."""
    if isinstance(node, str):
        return node if node.strip() else None
    if node.attrs.get("class") == "language-nav":
        return None
    children = [entry for child in node.children if (entry := retained_body(child)) is not None]
    return node.tag, node.attrs, children


def target_key(tag, attr, target, lang, pages):
    path = target.path
    if target.netloc == urlsplit(ORIGIN).netloc and path in pages:
        path = localized_path(path, lang)
    return tag, attr, target._replace(path=path)


def check_pages():
    pages = source_pages()
    expected = {
        localized_path(path, lang): (path, lang)
        for path in pages for lang in LANGUAGES
    }
    parsed = {
        path: list(elements(PageParser(filename_for(path).read_text(encoding="utf-8")).root))
        for path in expected
    }
    ids = {}
    for path, nodes in parsed.items():
        page_ids = [node.attrs["id"] for node in nodes if "id" in node.attrs]
        assert len(page_ids) == len(set(page_ids)), f"{path}: duplicate IDs"
        ids[path] = set(page_ids)

    link_count = 0
    for path, (original, lang) in expected.items():
        nodes = parsed[path]
        source = list(elements(pages[original]))
        code = LANGUAGES[lang][0]
        canonical = ORIGIN + path
        assert [node.attrs["lang"] for node in nodes if node.tag == "html"] == [code], path
        assert [node.attrs["href"] for node in nodes if node.attrs.get("rel") == "canonical"] == [canonical], path
        assert [node.attrs["content"] for node in nodes if node.attrs.get("property") == "og:url"] == [canonical], path
        assert {
            node.attrs["hreflang"]: node.attrs["href"]
            for node in nodes if node.tag == "link" and node.attrs.get("rel") == "alternate"
        } == alternates(original), path
        switch = [node for node in nodes if "data-language-link" in node.attrs]
        assert [(node.attrs["lang"], node.attrs["hreflang"], node.attrs["href"], text(node)) for node in switch] == [
            (tag, tag, localized_path(original, language), name)
            for language, (tag, _, name) in LANGUAGES.items()
        ], path
        assert [node.attrs["lang"] for node in switch if node.attrs.get("aria-current") == "page"] == [code], path
        assert ids[path] == ids[original], f"{path}: source fragment changed"
        assert {
            (node.attrs.get("name"), node.attrs.get("content"))
            for node in nodes if node.attrs.get("name", "").startswith("citation_")
        } == {
            (node.attrs.get("name"), node.attrs.get("content"))
            for node in source if node.attrs.get("name", "").startswith("citation_")
        }, f"{path}: citation metadata changed"

        source_body = next(node for node in source if node.tag == "body")
        body = next(node for node in nodes if node.tag == "body")
        if lang == "en":
            assert retained_body(body) == retained_body(source_body), f"{path}: English content changed"
        expected_targets = Counter(
            target_key(tag, attr, target, lang, pages)
            for tag, attr, target in hrefs(elements(source_body), original)
        )
        actual_targets = Counter(hrefs(elements(body), path))
        assert actual_targets == expected_targets, f"{path}: changed body link or asset target"

        if lang != "en":
            material_links = [
                node for node in nodes
                if node.tag == "a" and Path(urlsplit(node.attrs.get("href", "")).path).suffix in MATERIAL_EXTENSIONS
            ]
            assert all(node.attrs.get("hreflang") == "en" for node in material_links), path

        for tag, _, target in hrefs(nodes, path):
            if target.netloc != urlsplit(ORIGIN).netloc:
                continue
            if target.path in expected:
                if target.fragment:
                    assert unquote(target.fragment) in ids[target.path], f"{path}: missing target #{target.fragment}"
            else:
                assert (ROOT / unquote(target.path.lstrip("/"))).is_file(), f"{path}: missing {target.path}"
            link_count += 1
        if original == "/404.html":
            assert any(node.attrs.get("name") == "robots" and node.attrs.get("content") == "noindex" for node in nodes), path
    print(f"Checked {len(expected)} pages, including {link_count} internal links and asset references.")


def check_sitemap():
    original = ET.parse(SOURCE / "sitemap.xml").getroot()
    actual = ET.parse(ROOT / "sitemap.xml").getroot()
    locations = {}
    for entry in actual:
        loc = entry.findtext(f"{{{SITEMAP}}}loc")
        assert loc not in locations, f"{loc}: duplicate sitemap entry"
        locations[loc] = entry
    assert len(locations) == len(original) * len(LANGUAGES)
    for source in original:
        path = urlsplit(source.findtext(f"{{{SITEMAP}}}loc")).path
        for url in set(alternates(path).values()):
            entry = locations[url]
            assert entry.findtext(f"{{{SITEMAP}}}lastmod") == source.findtext(f"{{{SITEMAP}}}lastmod")
            assert {
                link.attrib["hreflang"]: link.attrib["href"]
                for link in entry.findall(f"{{{XHTML}}}link")
            } == alternates(path), url
    print(f"Checked {len(locations)} sitemap entries and preserved source dates.")


if __name__ == "__main__":
    check_pages()
    check_sitemap()
