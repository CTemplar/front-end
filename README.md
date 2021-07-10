# CTemplar Build

Official Angular cross-platform client for the CTemplar secure email service available at [https://ctemplar.com](https://ctemplar.com).

RELEASE: **v#WEBCLIENT_VERSION#**
SHA-256 CHECKSUM: **#INDEX_HASH#**

Find full release code and distribution at : [https://github.com/CTemplar/webclient/releases/latest](https://github.com/CTemplar/webclient/releases/latest)

## Transparent build code

We host our code publicly on Github. Every change there is tracked.
When we release a new version there are a few ways we guarantee there isn’t any change into the code.

- JavaScript files are using SRI, so they cannot be manipulated as the web browser will stop the execution and alert the user. We host them, but they are protected even from us, see next step.

- The `index.html` file is the main loaded file, the one decides which JS files and other things the site will load from the beginning, and `SRI` ensures they are those recognized. Every release we generate a SHA‌-256 checksum of it and we publish it here publicly (like traditional software does), any history change/manipulation will be tracked by Github.

- If users don’t trust this at all and they want to proof the checksum by hand is very easy too and we encourage doing it.
  They can open the source code from their browser (right click, view source code) copy the whole and generate the SHA‌-256
  checksum using their favourite offline tool (openssl, sha256sum, etc)
  or online (https://hash.online-convert.com/sha256-generator, https://md5file.com/calculator, etc).

- Moreover our build is also directly served from github using github pages from [gh-pages](https://github.com/CTemplar/webclient/tree/gh-pages) branch.
  It can be accessed on [gh.ctemplar.com](https://gh.ctemplar.com/)

## Calculate checksum

You can calculate checksum of `index.html` served by CTemplar website and the one in our github open source build code
and match their checksum. It should be same as mentioned at the top of this document.

### Calculate checksum of index.html served by CTemplar website

- Open [https://ctemplar.com](https://ctemplar.com)

- Right click, open menu and click on `View Page Source`, it will show you the website source code(`index.html`).

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/right-click.png)

- Copy the code and check its SHA-256 hash from any online/offline tool. In this guide we will save the code in a file and check its hash
  from both online and offline tool.

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/save-as-file.png)

  Make sure that you save `Web page, Html only` and not the complete webpage. You can also copy
  the whole code and save it in a text/html file yourself (Note : you should copy the exact code, no empty lines at start while pasting in file).

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/save-as-html-only-file.png)

- Calculate checksum of the saved file using offline cli.

  ```bash
  openssl dgst -sha256 view-source_https___ctemplar.com.html
  ```

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/calculate-hash-offline.png)

- Calculate checksum of the saved file using online tool.

  i). [https://hash.online-convert.com/sha256-generator](https://hash.online-convert.com/sha256-generator)

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/calculate-hash-online-1.png)

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/calculate-hash-online-1.1.png)

  ii). [https://md5file.com/calculator](https://md5file.com/calculator)

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/calculate-hash-online-2.png)

### Calculate checksum of index.html from open source github build code

- Open CTemplar [webclient](https://github.com/CTemplar/webclient) github code and go into dist folder or directly go
  to this link :: [/dist](/dist)

- Open `index.html` file inside dist folder and click on raw in order to access the raw content of this file.

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/hash-online-raw-1.png)

- Copy the content and save it in a file, or right click and `save as` html/text file or you can simply copy the link of this file from
  browser, which is [https://raw.githubusercontent.com/CTemplar/webclient/master/dist/index.html](https://raw.githubusercontent.com/CTemplar/webclient/master/dist/index.html)
  and check its hash online by providing this link.

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/save-github-file1.png)

- Calculate checksum of the saved file using offline cli.

  ```bash
  openssl dgst -sha256 index.html
  ```

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/calculate-hash-offline-github.png)

- Calculate checksum of the saved file using online tool.

  i). [https://hash.online-convert.com/sha256-generator](https://hash.online-convert.com/sha256-generator)

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/calculate-hash-online-github.png)

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/calculate-hash-online-github1.png)

  ii). [https://md5file.com/calculator](https://md5file.com/calculator)

  ![img](https://github.com/ctemplar/webclient/blob/master/docs/images/calculate-hash-online-github2.png)

## Why different checksum for electron client index.html

Electron client `index.html` requires a `base-href='./'` instead of `base-href='/'`.
That is the only one difference between electron client and webclient `index.html`.
A copy of electron client `index.html` is available inside this `dist` folder by the name of `electron-index.html`.

![img](https://github.com/ctemplar/webclient/blob/master/docs/images/electron-index-html-diff.png)
