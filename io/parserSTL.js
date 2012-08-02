/*
 * 
 *                  xxxxxxx      xxxxxxx
 *                   x:::::x    x:::::x 
 *                    x:::::x  x:::::x  
 *                     x:::::xx:::::x   
 *                      x::::::::::x    
 *                       x::::::::x     
 *                       x::::::::x     
 *                      x::::::::::x    
 *                     x:::::xx:::::x   
 *                    x:::::x  x:::::x  
 *                   x:::::x    x:::::x 
 *              THE xxxxxxx      xxxxxxx TOOLKIT
 *                    
 *                  http://www.goXTK.com
 *                   
 * Copyright (c) 2012 The X Toolkit Developers <dev@goXTK.com>
 *                   
 *    The X Toolkit (XTK) is licensed under the MIT License:
 *      http://www.opensource.org/licenses/mit-license.php
 * 
 *      "Free software" is a matter of liberty, not price.
 *      "Free" as in "free speech", not as in "free beer".
 *                                         - Richard M. Stallman
 * 
 * 
 */

// provides
goog.provide('X.parserSTL');

// requires
goog.require('X.event');
goog.require('X.parser');
goog.require('X.triplets');

/**
 * Create a parser for the .STL format. ASCII or binary format is supported.
 * 
 * @constructor
 * @extends X.parser
 */
X.parserSTL = function() {

  //
  // call the standard constructor of X.base
  goog.base(this);

  //
  // class attributes

  /**
   * @inheritDoc
   * @const
   */
  this._classname = 'parserSTL';

};
// inherit from X.parser
goog.inherits(X.parserSTL, X.parser);


/**
 * @inheritDoc
 */
X.parserSTL.prototype.parse = function(container, object, data, flag) {
  
  var p = object._points;
  var n = object._normals;
  
  if (!data instanceof ArrayBuffer) throw new Error("Bad input type");
  
  var Uint8_data = new Uint8Array(data);
  
  var begin = "";
  for (var i = 0 ; i<5 ; i++) {
    begin = begin + String.fromCharCode(Uint8_data[i] & 0xff);
  }
  
  if (begin=="solid") {
  
    // ASCII STL
  
    var i = 0;
    var lines = new Array();
    
    // parsing into JS string and at the same time in an array of lines (Uint16)
    var charCode;
    var line = "";
    while (i<Uint8_data.length) {
      charCode = Uint8_data[i] & 0xff;
      if (charCode == 0x0A) {
        lines.push(line);
        line="";
      } else line += String.fromCharCode(charCode);
      i++;
    }
    
    // read the file (optional) name (it is at least 1 space)
    var name = lines.pop();
    if (name!=" ") object._caption = name;
    
    var _size = lines.length;
    
    /*
     * Fast Duff's Device @author Miller Medeiros <http://millermedeiros.com>
     * 
     * @version 0.3 (2010/08/25)
     */
    var i = 0;
    var n2 = _size % 8;
    while (n2--) {
      this.parseLine(p, n, lines, i);
      i++;
    }

    n2 = (_size * 0.125) ^ 0;
    while (n2--) {
      this.parseLine(p, n, lines, i);
      i++;
      this.parseLine(p, n, lines, i);
      i++;
      this.parseLine(p, n, lines, i);
      i++;
      this.parseLine(p, n, lines, i);
      i++;
      this.parseLine(p, n, lines, i);
      i++;
      this.parseLine(p, n, lines, i);
      i++;
      this.parseLine(p, n, lines, i);
      i++;
      this.parseLine(p, n, lines, i);
      i++;
    }
  } else {
    
    // BINARY STL
    
    // read the header
    var name = "";
    for (var i=0 ; i<80 ; i++) {
      name = name + String.fromCharCode(Uint8_data[i] & 0xff);
    }
    object._caption = name;
    
    // number of triangles
    var Uint32_subdata = new Uint32Array(data.slice(80,84)); //4 bytes
    var n_triangles = Uint32_subdata[0];
    
    // read the triangles
    for (var i=0 ; i<n_triangles ; i++) { // 50 bytes per triangle
      var Float32_data = new Float32Array(data.slice(84+i*50,132+i*50)); // 48 bytes (4 per float, 3 floats per vector, 4 vectors) = 12 floats
      var Uint16_data = new Uint16Array(data.slice(132+i*50,134+i*50)); // 2 bytes for byte summ (must be 0 in standard) = 1 integer
      for (var k=1 ; k<4 ; k++) {
        p.add(Float32_data[3*k],Float32_data[3*k+1],Float32_data[3*k+2]);
        n.add(Float32_data[0],Float32_data[1],Float32_data[2]); // for flat shading
      }
    }
    alert(n_triangles+">"+p.count+":"+n.count+"=>"+data.byteLength);
  }

  // the object should be set up here, so let's fire a modified event
  var modifiedEvent = new X.event.ModifiedEvent();
  modifiedEvent._object = object;
  modifiedEvent._container = container;
  this.dispatchEvent(modifiedEvent);

};


/**
 * Parses a line of .STL data and modifies the given X.triplets containers.
 * 
 * @param {!X.triplets} p The object's points as a X.triplets container.
 * @param {!X.triplets} n The object's normals as a X.triplets container.
 * @param {!Array} data The data to parse.
 * @param {!number} index The index of the current line.
 * @protected
 */
X.parserSTL.prototype.parseLine = function(p, n, data, index) {

  // grab the current line
  var _data = data[index];

  // trim the line
  var line = _data.replace(/^\s+|\s+$/g, '');

  // split to array
  var lineFields = line.split(' ');

  if ( lineFields[0] == 'vertex' ) {

    // add point
    var x = parseFloat(lineFields[1]);
    var y = parseFloat(lineFields[2]);
    var z = parseFloat(lineFields[3]);
    p.add(x, y, z);

  } else if ( lineFields[0] == 'facet' ) {

    // add normals
    var x = parseFloat(lineFields[2]);
    var y = parseFloat(lineFields[3]);
    var z = parseFloat(lineFields[4]);
    n.add(x, y, z);
    n.add(x, y, z);
    n.add(x, y, z);

  }

};


// export symbols (required for advanced compilation)
goog.exportSymbol('X.parserSTL', X.parserSTL);
goog.exportSymbol('X.parserSTL.prototype.parse', X.parserSTL.prototype.parse);
