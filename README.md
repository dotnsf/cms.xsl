# CMS.xsl

## Overview

XSL を活用した CMS

**特徴**

- コンテンツデータは **XML** 形式で、コンテンツデータの見栄えは **XSL** 形式で管理
- コンテンツデータの見栄えとなる XSL テンプレートファイルを用意するだけ
  - サンプルテンプレート(`memo.xsl`)が１つ含まれています
  - サンプルテンプレートを参考に、自由にテンプレートを追加可能
  - コンテンツデータの作成時、および編集時には XSL テンプレートを自動変換して編集用画面を生成
  - XSL テンプレート毎にコンテンツの一覧画面を自動生成
  - コンテンツ生成後でもテンプレートは変更可能
- コンテンツデータがある程度追加され、新規追加や編集、削除する必要がなくなったコンテンツは **ファイナライズ** 処理によって静的コンテンツ化することができる
  - 静的コンテンツにした後は高速なウェブサーバーである `nginx` などで運用可能
  - 同様にして GitHub Pages や S3 オブジェクトストレージによるウェブコンテンツ化も可能になり、様々な形で運用できる


## How to setup

- Install `node.js`

- Edit `.env`

  - `APP_NAME`: name of your web contents(which would be displayed in web contents)


## How to run app

- `$ cd (WORKING_FOLDER)`

- `$ git clone https://github.com/dotnsf/cms.xsl`

- `$ cd cms.xsl`

- `$ npm install`

- `$ npm run start`

- Go `http://xx.xx.xx.xx:8080/`


## How to customize app

### How to add forms/views

- Create Form XSL file under `public/forms` folder:

  - This file is supposed to be a XSL form for each documents.

  - You can copy from `memo.xsl`

  - You need to specify:

    - `<xsl:value-of>` field for single line text

    - `<xsl:copy-of>` field for multi lines textarea

      - You might have to add `<pre>` tag over `<xsl:copy-of>` to view multilined-texts correctly.

```
<div style="text-align: center;">
<h1><xsl:value-of select="document/item[@name='subject']" /></h1>
</div>

<div>
<pre>
<xsl:copy-of select="document/item[@name='body']" />
</pre>
</div>
```

- View XML file would be generated under `public/views` folder:

  - This file would be named as `form`s.

  - This file is supposed to contain column fields of view.

  - You can customize this file for your document list.


## How to finalize app

- `$ cd (WORKING_FOLDER)/cms.xsl`

- `$ npm run finalize`

- You can find finalized contents under `./web/` folder


## How to run finalized app

- `$ cd (WORKING_FOLDER)/cms.xsl`

- `$ npm run web`

- Go `http://xx.xx.xx.xx:8000/`

  - or, just copy all files under `./web/` folder as web contents.


## Licensing

This code is licensed under MIT.


## Copyright

2023 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
