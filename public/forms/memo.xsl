<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
<xsl:output method="html" encoding="UTF-8"/>
<xsl:template match="/">
<html>
<head>
<title></title>
<link href="../resources/web.nsf.css" rel="stylesheet"/>
<script src="../resources/web.nsf.js"></script>
</head>
<body>
<div style="text-align: center;">
<h1><xsl:value-of select="document/item[@name='subject']" /></h1>
</div>
<div>
<pre>
<xsl:copy-of select="document/item[@name='body']" />
</pre>
</div>
<div style="text-align: right;">
<xsl:value-of select="document/item[@name='username']" />
</div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
