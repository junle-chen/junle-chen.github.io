# junle-chen.github.io

The live website at [junle-chen.github.io](https://junle-chen.github.io/) is built from
[junle-chen/ac-homepage](https://github.com/junle-chen/ac-homepage). That repository
remains the source of truth for the site's pages, assets, and application code.

This repository hosts the [GitHub Pages publishing workflow](.github/workflows/publish-ac-homepage.yml).
The workflow checks out `ac-homepage/main`, builds `dist/`, and deploys that artifact to
the root GitHub Pages URL. GitHub Pages is configured to publish from Actions, with no
custom domain on this repository. `publish-source.json` requests an immediate run when
its source revision changes; the workflow also checks for source updates periodically.
After pushing a change to `ac-homepage/main`, run `npm run pages:publish -- --wait` from
that source repository to request and verify an immediate deployment.

The previous Academic Pages website, including its original README, configuration,
content, assets, and issue templates, is preserved in
[archive/academic-pages](archive/academic-pages/). Its earlier Git history remains in
this repository. The archive is not part of the deployed website.

[junle.cc](https://junle.cc/) and [www.junle.cc](https://www.junle.cc/) are served by the
separate `ac-homepage/gh-pages` redirect deployment and lead to the root URL above.
