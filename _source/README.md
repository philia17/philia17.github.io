# Portfolio translations

The English originals in `templates/` are the shared source for every public HTML page.
`locales/en.json` lists the translatable text, attributes and metadata. Each other locale
has the same keys. Numbered markers such as `<1>…</1>` and `<2/>` preserve inline links,
formatting and line breaks. Keep the marker numbers and pairs when editing a translation.

The build uses only the Python 3.10+ standard library. From the repository root:

```sh
python3 _source/build.py
python3 _source/build.py --check
python3 -B _source/check.py
```

When editing English source, run `python3 _source/build.py --catalog`, review the
English catalog diff, and update the matching translations before rebuilding.
Use `--language fr` (or another locale code) for a preview of one locale.
The generated HTML and sitemap are committed for static GitHub Pages hosting.

English keeps the existing root URLs. Traditional Chinese, French, Japanese and
Korean are generated under `/zh/`, `/fr/`, `/ja/` and `/ko/`. The language links
work without JavaScript. With JavaScript, a switch carries the current anchor
to the same page in the selected language. The site never redirects visitors
based on their browser language.

The `PAPER_TITLES` and `INVARIANT` catalogs in `build.py` record official paper titles,
standalone author lists, names and labels retained across the site. Original
files remain at their original URLs. The localized pages label the English
PDFs and citation downloads. The localized `404.html` pages have direct URLs.
GitHub Pages serves the root `404.html` for missing URLs.
