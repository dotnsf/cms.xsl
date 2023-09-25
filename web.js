//. web.js
var express = require( 'express' ),
    app = express();

var contents_root = 'CONTENTS_ROOT' in process.env ? process.env.CONTENTS_ROOT : 'web';
var basic_user = 'BASIC_USER' in process.env ? process.env.BASIC_USER : '';
var basic_pass = 'BASIC_PASS' in process.env ? process.env.BASIC_PASS : '';

app.use( express.Router() );

if( basic_user && basic_pass ){
  app.use( '/*', function( req, res, next ){
    if( req.headers.authorization ){
      var b64auth = req.headers.authorization.split( ' ' )[1] || '';
      var [ user, pass ] = Buffer.from( b64auth, 'base64' ).toString().split( ':' );
      if( user == basic_user && pass == basic_pass ){
        //. correct
        return next();
      }else{
        res.set( 'WWW-Authenticate', 'Basic realm="401"' );
        res.status( 401 ).send( 'Authentication required.' );
      }
    }else{
      res.set( 'WWW-Authenticate', 'Basic realm="401"' );
      res.status( 401 ).send( 'Authentication required.' );
    }
  });
}

if( contents_root ){
  if( contents_root.startsWith( '/' ) ){
    app.use( express.static( contents_root ) );
  }else{
    app.use( express.static( __dirname + '/' + contents_root ) );
  }
}

var port = process.env.PORT || 8000;
app.listen( port );
console.log( "server starting on " + port + " ..." );
