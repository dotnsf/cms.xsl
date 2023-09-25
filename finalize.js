//. finalize.js
var fs = require( 'fs' );

require( 'dotenv' ).config();
var APP_NAME = 'APP_NAME' in process.env ? process.env.APP_NAME : '';

var xpath = require( 'xpath' );
var dom = require( '@xmldom/xmldom' ).DOMParser;
var select = xpath.useNamespaces( { /* a: 'http://www.lotus.com/dxl' */ } );  //. xmlns を指定する場合は、ここで指定する

var target_src_dir = __dirname + '/public';
var target_dst_dir = __dirname + '/web';

if( !fs.existsSync( target_dst_dir ) ){
  fs.mkdirSync( target_dst_dir );
}

//. リソースファイル
var src_resources_dir = target_src_dir + '/resources';
var dst_resources_dir = target_dst_dir + '/resources';
if( !fs.existsSync( dst_resources_dir ) ){
  fs.mkdirSync( dst_resources_dir );
}
var filenames = fs.readdirSync( src_resources_dir );
filenames.forEach( function( filename ){
  if( !filename.startsWith( "." ) ){
    var src_resource_filepath = src_resources_dir + '/' + filename;
    var dst_resource_filepath = dst_resources_dir + '/' + filename;
    fs.copyFileSync( src_resource_filepath, dst_resource_filepath );
  }
});

//. index.html （フレームセット）
var templates_dir = __dirname + '/views';
var index_ejs_filepath = templates_dir + '/index.ejs';
if( fs.existsSync( index_ejs_filepath ) ){
  var index_ejs = fs.readFileSync( index_ejs_filepath, 'utf-8' );
  var index_html = index_ejs.split( '<%= title %>' ).join( APP_NAME );
  index_html = index_html.split( '/views' ).join( '/views.html' );
  var index_html_filepath = target_dst_dir + '/index.html';
  fs.writeFileSync( index_html_filepath, index_html );
}

//. views.html
var view_names = [];  //. [ 'memos' ]
var views_ejs_filepath = templates_dir + '/views.ejs';
if( fs.existsSync( views_ejs_filepath ) ){
  var src_views_dir = target_src_dir + '/views';
  var filenames = fs.readdirSync( src_views_dir );
  filenames.forEach( function( filename ){
    if( !filename.startsWith( "." ) && filename.toLowerCase().endsWith( ".xml" ) ){
      var view_name = filename.substring( 0, filename.length - 4 );
      view_names.push( view_name );
    }
  });

  var anchors = '';
  for( var i = 0; i < view_names.length; i ++ ){
    var a = '<a target="docs" href="./views/' + view_names[i] + '.html">' + view_names[i] + '</a>';
    anchors += a;
  }

  var views_ejs = fs.readFileSync( views_ejs_filepath, 'utf-8' );
  var views_html = views_ejs.split( '<%= title %>' ).join( APP_NAME );
  var n1 = views_html.indexOf( '<% for(' );
  var n2 = views_html.indexOf( '<% } %>', n1 + 1 );
  if( n1 > -1 && n2 > n1 + 1 ){
    views_html = views_html.substring( 0, n1 )
      + anchors
      + views_html.substring( n2 + 7 );

    var views_html_filepath = target_dst_dir + '/views.html';
    fs.writeFileSync( views_html_filepath, views_html );
  }
}

//. 各 view.html が扱う doc_ids
var view_doc_ids = {};
for( var i = 0; i < view_names.length; i ++ ){
  view_doc_ids[view_names[i]] = [];
}

//. 各 doc.xml
var src_doc_dir = target_src_dir + '/documents';
var dst_doc_dir = target_dst_dir + '/documents';
if( !fs.existsSync( dst_doc_dir ) ){
  fs.mkdirSync( dst_doc_dir );
}
var filenames = fs.readdirSync( src_doc_dir );
filenames.forEach( function( filename ){
  if( !filename.startsWith( "." ) && filename.toLowerCase().endsWith( ".xml" ) ){
    var doc_id = filename.substring( 0, filename.length - 4 );

    var src_doc_xml_filepath = src_doc_dir + '/' + filename;
    if( fs.existsSync( src_doc_xml_filepath ) ){
      var values = {};
      var form = null;
      var doc_xml = fs.readFileSync( src_doc_xml_filepath, 'utf-8' );
      var xml = new dom().parseFromString( doc_xml, 'text/xml' );
      var _form = select( "document/@form", xml, true );

      if( _form ){ form = _form.nodeValue; }
      if( form ){
        var view_name = form + 's';
        view_doc_ids[view_name].push( doc_id );

        var n1 = doc_xml.indexOf( '<document ' );
        if( n1 > -1 ){
          doc_xml = doc_xml.substring( 0, n1 )
            + '<?xml-stylesheet type="text/xsl" href="../forms/' + form + '.xsl"?>'
            + doc_xml.substring( n1 );

          var dst_doc_xml_filepath = dst_doc_dir + '/' + filename;
          fs.writeFileSync( dst_doc_xml_filepath, doc_xml );
        }
      }
    }
  }
});

//. 各 form.xsl
var src_forms_dir = target_src_dir + '/forms';
var dst_forms_dir = target_dst_dir + '/forms';
if( !fs.existsSync( dst_forms_dir ) ){
  fs.mkdirSync( dst_forms_dir );
}
Object.keys( view_doc_ids ).forEach( function( view_name ){
  var form_name = view_name.substring( 0, view_name.length - 1 );
  var src_form_filepath = src_forms_dir + '/' + form_name + '.xsl';
  var dst_form_filepath = dst_forms_dir + '/' + form_name + '.xsl';
  fs.copyFileSync( src_form_filepath, dst_form_filepath );
});

//. 各 view.html
var src_views_dir = target_src_dir + '/views';
var dst_views_dir = target_dst_dir + '/views';
if( !fs.existsSync( dst_views_dir ) ){
  fs.mkdirSync( dst_views_dir );
}

var docs_ejs_filepath = templates_dir + '/docs.ejs';
if( fs.existsSync( docs_ejs_filepath ) ){
  var docs_ejs = fs.readFileSync( docs_ejs_filepath, 'utf-8' );
  
  //. remove "Create" button
  var n1 = docs_ejs.indexOf( '<div class="container">' );
  var n2 = docs_ejs.indexOf( '</div>' );
  if( n1 > -1 && n2 > n1 + 1 ){
    docs_ejs = docs_ejs.substring( 0, n1 )
      + docs_ejs.substring( n2 + 6 );
  }

  Object.keys( view_doc_ids ).forEach( function( view_name ){
    var form_name = view_name.substring( 0, view_name.length - 1 );
    var dst_view_filepath = dst_views_dir + '/' + view_name + '.html';
    var doc_ids = view_doc_ids[view_name];

    var view_html = docs_ejs;

    var src_view_filepath = src_views_dir + '/' + view_name + '.xml';
    var src_view_xml = fs.readFileSync( src_view_filepath, 'utf-8' );
    var xml = new dom().parseFromString( src_view_xml, 'text/xml' );
    var view_displayname = view_name;
    var _view_displayname = select( "view/@displayname", xml, true );
    if( _view_displayname ){ view_displayname = _view_displayname.nodeValue; }
    var field_names = [];
    var view_item_nodes = select( "view/item", xml, false );
    if( view_item_nodes ){
      view_item_nodes.forEach( async function( view_item_node ){
        var field_name = select( "@name", view_item_node, true ).nodeValue;
        field_names.push( field_name );
      });
    }

    view_html = view_html.split( '<%= view %>' ).join( view_displayname );
    view_html = view_html.split( '<%= view_cols.length %>' ).join( '' + field_names.length );

    n1 = view_html.indexOf( '<% for(' );
    n2 = view_html.indexOf( '<% } %>', n1 + 1 );
    if( n1 > -1 && n2 > n1 + 1 ){
      var thead_ths = '';
      for( var i = 0; i < field_names.length; i ++ ){
        thead_ths += '<th>' + field_names[i] + '</th>';
      }

      view_html = view_html.substring( 0, n1 )
        + thead_ths
        + view_html.substring( n2 + 7 );
    }

    n1 = view_html.indexOf( '<% for(' );
    n2 = view_html.lastIndexOf( '<% } %>' );
    if( n1 > -1 && n2 > -1 ){
      var tbody_trs = '';
      for( var i = 0; i < doc_ids.length; i ++ ){
        var doc_id = doc_ids[i];
        var src_doc_filepath = src_doc_dir + '/' + doc_id + '.xml';
        var src_doc_xml = fs.readFileSync( src_doc_filepath, 'utf-8' );
        var xml = new dom().parseFromString( src_doc_xml, 'text/xml' );
        var doc_item_nodes = select( "document/item", xml, false );
        var item_values = {};
        if( doc_item_nodes ){
          doc_item_nodes.forEach( async function( doc_item_node ){
            var item_name = select( "@name", doc_item_node, true ).nodeValue;
            var item_value = select( "text()", doc_item_node, true ).nodeValue;
            item_values[item_name] = item_value;
          });
        }

        var tr = '<tr>';
        for( var j = 0; j < field_names.length; j ++ ){
          tr += '<td>'
            + '<a target="doc" href="../documents/' + doc_ids[i] + '.xml">'
            + item_values[field_names[j]]
            + '</a>'
            + '</td>';
        }
        tr += '</tr>';
        tbody_trs += tr;
      }

      view_html = view_html.substring( 0, n1 )
        + tbody_trs
        + view_html.substring( n2 + 7 );
      fs.writeFileSync( dst_view_filepath, view_html );
    }
  });
}
console.log( 'done.' );
