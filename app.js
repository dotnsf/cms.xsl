//. app.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    crypto = require( 'crypto' ),
    ejs = require( 'ejs' ),
    fs = require( 'fs' ),
    app = express();

require( 'dotenv' ).config();
var APP_NAME = 'APP_NAME' in process.env ? process.env.APP_NAME : '';

var xpath = require( 'xpath' );
var dom = require( '@xmldom/xmldom' ).DOMParser;
//var select = xpath.useNamespaces( { /* a: 'http://www.lotus.com/dxl' */ } );  //. xmlns を指定する場合は、ここで指定する
var select = xpath.useNamespaces( { xsl: 'http://www.w3.org/1999/XSL/Transform' } );

var target_dir = __dirname + '/public';

app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );
app.use( express.static( target_dir ) );

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

app.use( function( req, res, next ){
  if( req && req.query && req.query.error ){
    console.log( req.query.error );
  }
  if( req && req.query && req.query.error_description ){
    console.log( req.query.error_description );
  }
  next();
});

//. index（フレームセット）
app.get( '/', async function( req, res ){
  //. #4
  var forms = await app.readForms();
  if( forms ){
    forms.forEach( async function( form ){
      var view = form + 's';
      var r = await app.createViewXML( view );
    });
  }

  var title = req.query.title ? req.query.title : APP_NAME;
  res.render( 'index', { title: title } );
});

//. views（ビュー一覧）
app.get( '/views', async function( req, res ){
  var title = req.query.title ? req.query.title : APP_NAME;
  var views = await app.readViews();
  res.render( 'views', { title: title, views: views } );
});

//. docs（ビュー内の文書一覧）
app.get( '/docs/:view', async function( req, res ){
  var view = req.params.view;
  var form = view.substr( 0, view.length - 1 );

  //. ビュー用の XML が存在していない場合は作成する
  var r = await app.createViewXML( view );

  var docs = await app.readDocs( view );
  res.render( 'docs', { view: view, form: form, view_cols: r.view_cols, docs: docs } );
});

app.get( '/form/:form', async function( req, res ){
  res.contentType( 'text/html; charset=utf-8' );

  var form = req.params.form;
  var form_html = await app.transformXSL( form, null );
  res.write( form_html );
  res.end();
});

app.get( '/doc/:doc_id', async function( req, res ){
  var doc_id = req.params.doc_id;
  var doc = await app.readDoc( doc_id );
  var form = doc.form;

  var is_edit = req.query.edit;
  var is_delete = req.query.delete;
  if( is_edit ){
    res.contentType( 'text/html; charset=utf-8' );
    var form_html = await app.transformXSL( form, doc_id, false );
    res.write( form_html );
    res.end();
  }else if( is_delete ){
    var r = await app.deleteDoc( doc_id );
    res.redirect( '/docs/' + form + 's' );   //. /docs/:view_name
  }else{
    res.contentType( 'text/xml; charset=utf-8' );
    var form_html = await app.transformXSL( form, doc_id, true );
    res.write( form_html );
    res.end();
  }
});

app.post( '/doc', async function( req, res ){
  res.contentType( 'text/html; charset=utf-8' );

  var body = req.body;   //. form は body.$form
  var id = await app.createDoc( body );
  if( id ){
    res.redirect( '/doc/' + id )
  }else{
    res.write( 'save error' );
    res.end();
  }
});

app.post( '/doc/:doc_id', async function( req, res ){
  res.contentType( 'text/html; charset=utf-8' );

  var doc_id = req.params.doc_id;
  //var doc = await app.readDoc( doc_id );

  var body = req.body;   //. id は body.$id 、form は body.$form
  var id = await app.updateDoc( body, doc_id );
  if( id ){
    res.redirect( '/doc/' + id )
  }else{
    res.write( 'updated error' );
    res.end();
  }
});

app.delete( '/doc/:doc_id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var doc_id = req.params.doc_id;
  var b = await app.deleteDoc( doc_id );
});


app.readForms = async function(){
  return new Promise( async function( resolve, reject ){
    var forms = [];
    var forms_subfolder = target_dir + '/forms';
    var filenames = fs.readdirSync( forms_subfolder );
    filenames.forEach( function( filename ){
      if( filename.toLowerCase().endsWith( ".xsl" ) ){
        var formname = filename.substring( 0, filename.length - 4 );
        forms.push( formname );
      }
    });

    resolve( forms );
  });
};

app.readViews = async function(){
  return new Promise( async function( resolve, reject ){
    var views = [];
    var views_subfolder = target_dir + '/views';
    var filenames = fs.readdirSync( views_subfolder );
    filenames.forEach( function( filename ){
      if( filename.toLowerCase().endsWith( ".xml" ) ){
        var viewname = filename.substring( 0, filename.length - 4 );
        views.push( viewname );
      }
    });

    resolve( views );
  });
};

//. 指定した view の XML があるかチェックし、なかったら作成する
app.createViewXML = async function( view ){
  return new Promise( async function( resolve, reject ){
    var created = false;
    var field_names = [];

    var views_subfolder = target_dir + '/views';
    var view_xml_filepath = views_subfolder + '/' + view + '.xml';
    var view_name = view;
    var view_displayname = view;
    if( !fs.existsSync( view_xml_filepath ) ){
      var view_xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<view name="' + view + '" displayname="' + view + '">\n';
      var form = view.substr( 0, view.length - 1 );
      var forms_subfolder = target_dir + '/forms';
      var form_xsl_filepath = forms_subfolder + '/' + form + '.xsl';
      var form_xsl = fs.readFileSync( form_xsl_filepath, 'utf-8' );

      /* xpath を使わずに実装する
      var xsl = new dom().parseFromString( form_xsl, 'text/xml' );

      var body_nodes = select( "/html", xsl, true ); 
      console.log({body_nodes});  //. この時点で取得できてない・・

      var valueof_nodes = select( "html/body/xsl:value-of", xsl, false );  //. = [] になってしまう
      console.log({valueof_nodes});
      if( valueof_nodes ){
        valueof_nodes.forEach( async function( valueof_node ){
          var valueof_select = select( "@select", valueof_node, true ).nodeValue; //. document/item[@name='Subject']
          var n1 = valueof_select.indexOf( "'" );
          if( n1 > -1 ){
            var n2 = valueof_select.indexOf( "'", n1 + 1 );
            if( n2 > -1 ){
              var field_name = valueof_select.substring( n1 + 1, n2 );
              field_names.push( field_name );
            }
          }
        });
      }
      */
      var n1 = form_xsl.indexOf( '<xsl:value-of ' );
      while( n1 > -1 ){
        var n2 = form_xsl.indexOf( ' />', n1 + 1 );
        if( n2 > n1 + 1 ){
          var xsl_valueof = form_xsl.substring( n1, n2 + 3 );
          n2 = xsl_valueof.indexOf( "@name='" );
          var n3 = xsl_valueof.indexOf( "'", n2 + 7 );
          if( n2 > -1 && n3 > n2 + 7 ){
            var field_name = xsl_valueof.substring( n2 + 7, n3 );
            field_names.push( field_name );
          }
        }

        n1 = form_xsl.indexOf( '<xsl:value-of ', n1 + 1 );
      }

      /* ここで取り出すフィールド名は xsl:value-of のものだけでいい
      var copyof_nodes = select( "/html/body/xsl:copy-of", xsl, false );
      if( copyof_nodes ){
        copyof_nodes.forEach( async function( copyof_node ){
          var copyof_select = select( "@select", copyof_node, true ).nodeValue; //. document/item[@name='Body']
        });
      }
      */

      if( field_names.length > 0 ){
        for( var i = 0; i < field_names.length; i ++ ){
          var field_name = field_names[i];
          var item = '<item name="' + field_name + '"/>\n';  //. 属性は name だけでいい？
          view_xml += item;
        }
      }

      view_xml += '</view>\n';

      fs.writeFileSync( view_xml_filepath, view_xml );

      created = true;
    }else{
      var view_xml = fs.readFileSync( view_xml_filepath, 'utf-8' );
      var xml = new dom().parseFromString( view_xml, 'text/xml' );
      var _view_name = select( "view/@name", xml, true );
      if( _view_name ){ view_name = _view_name.nodeValue; }
      var _view_displayname = select( "view/@displayname", xml, true );
      if( _view_displayname ){ view_displayname = _view_displayname.nodeValue; }
      var view_item_nodes = select( "view/item", xml, false );
      if( view_item_nodes ){
        view_item_nodes.forEach( async function( view_item_node ){
          var field_name = select( "@name", view_item_node, true ).nodeValue;
          field_names.push( field_name );
        });
      }
    }
  
    resolve( { name: view_name, displayname: view_displayname, view_cols: field_names, created: created } );
  });
};

app.readDocs = async function( view ){
  return new Promise( async function( resolve, reject ){
    var docs = [];
    var views_subfolder = target_dir + '/views';
    var view_xml_filepath = views_subfolder + '/' + view + '.xml';
    if( fs.existsSync( view_xml_filepath ) ){
      var field_names = [];
      var view_xml = fs.readFileSync( view_xml_filepath, 'utf-8' );
      var xml = new dom().parseFromString( view_xml, 'text/xml' );
      var view_item_nodes = select( "view/item", xml, false );
      if( view_item_nodes ){
        view_item_nodes.forEach( async function( view_item_node ){
          var field_name = select( "@name", view_item_node, true ).nodeValue;
          field_names.push( field_name );
        });
      }

      if( field_names.length > 0 ){
        var form = view.substr( 0, view.length - 1 );
        var docs_subfolder = target_dir + '/documents';
        var filenames = fs.readdirSync( docs_subfolder );
        filenames.forEach( function( filename ){
          if( filename.toLowerCase().endsWith( ".xml" ) ){
            var doc_xml_filepath = docs_subfolder + '/' + filename;
            var doc_id = filename.substring( 0, filename.length - 4 );

            var doc_xml = fs.readFileSync( doc_xml_filepath, 'utf-8' );

            var xml = new dom().parseFromString( doc_xml, 'text/xml' );
            var document_node = select( "document", xml, true );
            if( document_node ){
              var form_name = select( "@form", document_node, true ).nodeValue;
              if( form_name == form ){
                var doc = { _id: doc_id, _filename: filename };
                doc['$id'] = doc_id;
                doc['$form'] = form;
                for( var i = 0; i < field_names.length; i ++ ){
                  var item_node_value = select( "item[@name='" + field_names[i] + "']/text()", document_node, true ).nodeValue;
                  doc[field_names[i]] = item_node_value;
                }

                docs.push( doc );
              }
            }
          }
        });
      }
    }

    resolve( docs );
  });
}

app.readDoc = async function( doc_id ){
  return new Promise( async function( resolve, reject ){
    var doc = null;
    var docs_subfolder = target_dir + '/documents';
    var doc_xml_filepath = docs_subfolder + '/' + doc_id + '.xml';
    if( fs.existsSync( doc_xml_filepath ) ){
      var values = {};
      var form = null;
      var doc_xml = fs.readFileSync( doc_xml_filepath, 'utf-8' );
      var xml = new dom().parseFromString( doc_xml, 'text/xml' );
      var _form = select( "document/@form", xml, true );
      if( _form ){ form = _form.nodeValue; }
      var doc_item_nodes = select( "document/item", xml, false );
      if( doc_item_nodes ){
        doc_item_nodes.forEach( async function( doc_item_node ){
          var field_name = select( "@name", doc_item_node, true ).nodeValue;
          //var field_value = doc_item_node.nodeValue;
          var field_value = select( "text()", doc_item_node, true );
          if( field_value && field_value.nodeValue ){
            field_value = field_value.nodeValue;
          }else{
            //. #3 値が <p>～～</p><p>～～</p> のようなリッチテキストだと値が正しく取得できずにここに来る
            //. text() ではなく、html タグごと取得する方法が必要
            field_value = '';//select( "parent/text()", doc_item_node, true ).nodeValue;
          }
          values[field_name] = field_value;
        });
      }

      doc = { xml: doc_xml, form: form, values: values };
    }

    resolve( doc );
  });
}

app.deleteDoc = async function( doc_id ){
  return new Promise( async function( resolve, reject ){
    var b = false;
    var docs_subfolder = target_dir + '/documents';
    var doc_xml_filepath = docs_subfolder + '/' + doc_id + '.xml';
    console.log( {doc_xml_filepath} );
    if( fs.existsSync( doc_xml_filepath ) ){
      try{
        fs.unlinkSync( doc_xml_filepath );
        b = true;
      }catch( e ){
        console.log( e );
      }
    }else{
    }

    resolve( b );
  });
}

app.readDocXML = async function( doc_id ){
  return new Promise( async function( resolve, reject ){
    var docs_subfolder = target_dir + '/documents';
    var doc_xml_filepath = docs_subfolder + '/' + doc_id + '.xml';
    var doc_xml = fs.readFileSync( doc_xml_filepath, 'utf-8' );

    resolve( doc_xml );
  });
};

app.readFormXSL = async function( form ){
  return new Promise( async function( resolve, reject ){
    var forms_subfolder = target_dir + '/forms';
    var form_xsl_filepath = forms_subfolder + '/' + form + '.xsl';
    var form_xsl = fs.readFileSync( form_xsl_filepath, 'utf-8' );

    resolve( form_xsl );
  });
};

app.transformXSL = async function( form, doc_id, is_display ){
  return new Promise( async function( resolve, reject ){
    var values = [];
    var form_xsl = await app.readFormXSL( form );

    if( is_display ){
      var doc_xml = await app.readDocXML( doc_id );
      var n1 = doc_xml.toLowerCase().indexOf( '<document ' );
      if( n1 > -1 ){
        doc_xml = doc_xml.substring( 0, n1 )
          + '<?xml-stylesheet type="text/xsl" href="../forms/' + form + '.xsl"?>'
          + doc_xml.substring( n1 );
      }else{
      }

      resolve( doc_xml );
    }else{
      if( doc_id ){
        var doc = await app.readDoc( doc_id );
        values = doc.values;
      }

      //. Button
      var n1 = form_xsl.toLowerCase().indexOf( '<body' );
      var n2 = form_xsl.toLowerCase().indexOf( '>', n1 + 1 );
      var n3 = form_xsl.toLowerCase().indexOf( '</body>', n2 + 1 );
      if( n1 > -1 && n2 > n1 + 1 && n3 > n2 + 1 ){
        //form_xsl = form_xsl.substring( n1, n3 )
        form_xsl = form_xsl.substring( n1, n2 + 1 )
          + '<form method="POST" action="/doc' + ( doc_id ? '/' + doc_id : '' ) + '">'
          + ( doc_id ? '<input type="hidden" name="$id" value="' + doc_id + '"/>' : '' )
          + '<input type="hidden" name="$form" value="' + form + '"/>'
          + '<div style="text-align: right;">'
          + '<input class="btn btn-primary" type="submit" value="' + ( doc_id ? 'Update' : 'Create' ) + '"/>'
          + '</div>'
          + form_xsl.substring( n2 + 1, n3 );
          + '</form>'
          + form_xsl.substring( n3, n3 + 7 );

        //. <xsl:value-of>
        n1 = form_xsl.indexOf( '<xsl:value-of ' );
        while( n1 > -1 ){
          var n0 = form_xsl.indexOf( '/>', n1 + 1 );
          var xsl_valueof = form_xsl.substring( n1, n0 + 2 );
    
          n2 = form_xsl.indexOf( ' select="', n1 + 1 );
          if( n2 > n1 ){
            n3 = form_xsl.indexOf( '"', n2 + 9 );
            if( n3 > n2 + 9 ){
              var item = form_xsl.substring( n2 + 9, n3 );   //. document/item[@name='Subject']
              var n4 = item.indexOf( "'" );
              var n5 = item.indexOf( "'", n4 + 1 );
              if( n4 > -1 && n5 > n4 ){
                var field_name = item.substring( n4 + 1, n5 ); //. Subject
                var value = ( values && field_name in values ) ? values[field_name] : '';
  
                form_xsl = form_xsl.substr( 0, n1 ) 
                  + '<input type="text" id="' + field_name + '" name="' + field_name + '" value="' + value + '" placeholder="' + field_name + '"/>'
                  + form_xsl.substr( n0 + 2 );
              }
            }
          }
  
          n1 = form_xsl.indexOf( '<xsl:value-of ', n1 + 1 );
        }
  
        //. <xsl:copy-of>
        n1 = form_xsl.indexOf( '<xsl:copy-of ' );
        while( n1 > -1 ){
          var n0 = form_xsl.indexOf( '/>', n1 + 1 );
          var xsl_copyof = form_xsl.substring( n1, n0 + 2 );
  
          n2 = form_xsl.indexOf( ' select="', n1 + 1 );
          if( n2 > n1 ){
            n3 = form_xsl.indexOf( '"', n2 + 9 );
            if( n3 > n2 + 9 ){
              var item = form_xsl.substring( n2 + 9, n3 );   //. document/item[@name='Body']
              var n4 = item.indexOf( "'" );
              var n5 = item.indexOf( "'", n4 + 1 );
              if( n4 > -1 && n5 > n4 ){
                var field_name = item.substring( n4 + 1, n5 ); //. Body
                var value = ( values && field_name in values ) ? values[field_name] : '';
    
                form_xsl = form_xsl.substr( 0, n1 ) 
                  + '<textarea class="trumbowyg" id="' + field_name + '" name="' + field_name + '" placeholder="' + field_name + '">' + value + '</textarea>'
                  + form_xsl.substr( n0 + 2 );
              }
            }
          }


          n1 = form_xsl.indexOf( '<xsl:copy-of ', n1 + 1 );
        }
      }else{
        form_xsl = '<body>No &lt;body&gt; tag found in form XSL.</body>';
      }

      var form_html = '<html>\n'
        + '<head>\n'
        + '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n'
        + '<script src="//code.jquery.com/jquery-2.2.4.min.js"></script>\n'
        //+ '<link rel="stylesheet" href="//cdn.datatables.net/t/bs-3.3.6/jqc-1.12.0,dt-1.10.11/datatables.min.css"/>\n'
        //+ '<script src="//cdn.datatables.net/t/bs-3.3.6/jqc-1.12.0,dt-1.10.11/datatables.min.js"></script>\n'
        + '<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.5.1/css/bootstrap.min.css" rel="stylesheet"/>\n'
        + '<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.5.1/js/bootstrap.min.js"></script>\n'
        + '<link href="//use.fontawesome.com/releases/v5.15.4/css/all.css" rel="stylesheet"/>\n'
        + '<link href="../resources/web.nsf.css" rel="stylesheet"/>\n'
        + '<script src="../resources/web.nsf.js"></script>\n'

        //. #3
        + '<script src="//ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>\n'
        + '<script src="//cdnjs.cloudflare.com/ajax/libs/Trumbowyg/2.25.2/trumbowyg.min.js"></script>\n'
        + '<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/Trumbowyg/2.25.2/ui/trumbowyg.min.css"/>\n'
        + '<script>\n'
        //+ '<xsl:comment>\n'
        //+ '<![CDATA[\n'
        + '$(function(){\n'
        + '//  $(".trumbowyg").trumbowyg();\n'   //. タグを有効にすると <textarea> の xpath がおかしくなる
        + '});\n'
        //+ ']]>\n'
        //+ '</xsl:comment>\n'
        + '</script>\n'

        + '</head>\n'
        + form_xsl
        + '</html>\n';
  
      resolve( form_html );
    }

  });
};


app.createDoc = async function( body ){
  return new Promise( async function( resolve, reject ){
    try{
      var id = crypto.randomUUID();
      var form = body['$form'];
      var docs_subfolder = target_dir + '/documents';
      var doc_xml_filepath = docs_subfolder + '/' + id + '.xml';
      var doc_xml = '<?xml version="1.0" encoding="UTF-8"?>'
        + '<document form="' + form + '">';

      doc_xml += '<item name="$id">' + id + '</item>';
      Object.keys( body ).forEach( function( field_name ){
        doc_xml += '<item name="' + field_name + '">' + body[field_name] + '</item>';
      });
      
      doc_xml += '</document>';
      fs.writeFileSync( doc_xml_filepath, doc_xml );

      resolve( id );
    }catch( e ){
      console.log( e );
      resolve( null );
    }
  });
}

app.updateDoc = async function( body, id ){
  return new Promise( async function( resolve, reject ){
    try{
      var form = body['$form'];
      var docs_subfolder = target_dir + '/documents';
      var doc_xml_filepath = docs_subfolder + '/' + id + '.xml';
      var doc_xml = '<?xml version="1.0" encoding="UTF-8"?>'
        + '<document form="' + form + '">';

      Object.keys( body ).forEach( function( field_name ){
        doc_xml += '<item name="' + field_name + '">' + body[field_name] + '</item>';
      });
      
      doc_xml += '</document>';
      fs.writeFileSync( doc_xml_filepath, doc_xml );

      resolve( id );
    }catch( e ){
      console.log( e );
      resolve( null );
    }
  });
}


var port = process.env.PORT || 8080;
app.listen( port );
console.log( "server starting on " + port + " ..." );
