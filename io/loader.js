/*
 * ${HEADER}
 */

// provides
goog.provide('X.loader');

// requires
goog.require('X.base');
goog.require('X.event');
goog.require('X.exception');
goog.require('X.object');
goog.require('X.parserSTL');
goog.require('X.parserTRK');
goog.require('X.parserVTK');
goog.require('goog.events.EventType');
goog.require('goog.structs.Map');

/**
 * This object loads external files in an asynchronous fashion. In addition, the
 * loading process is monitored and summarized to a total progress value.
 * 
 * @constructor
 * @extends X.base
 */
X.loader = function() {

  // call the standard constructor of X.base
  goog.base(this);
  
  //
  // class attributes
  
  /**
   * @inheritDoc
   * @const
   */
  this._className = 'loader';
  
  /**
   * @private
   */
  this._jobs_ = null;
  
  this._progress_ = 0;
  
};
// inherit from X.base
goog.inherits(X.loader, X.base);


X.loader.prototype.jobs_ = function() {

  if (!goog.isDefAndNotNull(this._jobs_)) {
    
    this._jobs_ = new goog.structs.Map();
    
  }
  
  return this._jobs_;
  
};


X.loader.prototype.completed = function() {

  if (!goog.isDefAndNotNull(this._jobs_)) {
    
    // there are no jobs (and they never were)
    // this is a quick 'jump out'
    return true;
    
  }
  
  // now we check if all of our jobs are completed
  return !this._jobs_.containsValue(false);
  
};

X.loader.prototype.loadTexture = function(object) {

  if (!goog.isDefAndNotNull(object.texture())) {
    
    throw new X.exception('Fatal: Internal error during texture loading.');
    
  }
  
  // setup the image object
  var image = new Image();
  var currentTextureFilename = object.texture().file();
  image.src = currentTextureFilename;
  
  // we let the object point to this image
  object.texture().setImage(image);
  
  // handler after the image was completely loaded
  goog.events.listenOnce(image, goog.events.EventType.LOAD,
      this.loadTextureCompleted.bind(this, object));
  
  // add this loading job to our jobs map
  this.jobs_().set(object.id(), false);
  
  // this is a very fast step so we count it as 30% of the total texture load
  // time
  this.addProgress(0.3);
};

X.loader.prototype.loadTextureCompleted = function(object) {

  // at this point the image for the texture was loaded properly
  object.texture().setClean();
  
  // fire the modified event
  object.modified();
  
  // mark the loading job as completed
  this.jobs_().set(object.id(), true);
  
  // here we add the rest of the setup step 0.7 and a full progress tick for the
  // load completion
  this.addProgress(1.7);
  
};

X.loader.prototype.loadFile = function(object) {

  if (!goog.isDefAndNotNull(object.file())) {
    
    // should not happen :)
    throw new X.exception('Fatal: Internal error during file loading.');
    
  }
  
  // clear all points and normals of the object
  object.points().clear();
  object.normals().clear();
  
  // get the associated file of the object
  var file = object.file();
  
  // check if the file is supported
  var fileExtension = file.split('.').pop();
  fileExtension = fileExtension.toUpperCase();
  
  if (!(fileExtension in X.parser.extensions)) {
    
    // file format is not supported
    throw new X.exception('Fatal: The ' + fileExtension +
        ' file format is not supported!');
    
  }
  
  // we use a simple XHR to get the file contents
  // this works for binary and for ascii files
  var request = new XMLHttpRequest();
  
  // listen to progress events.. here, goog.events.listen did not work
  request.addEventListener('progress',
      this.loadFileProgress.bind(this, object), false);
  
  // listen to abort events
  goog.events.listen(request, 'abort', this.loadFileFailed.bind(this, request,
      object));
  
  // listen to error events
  goog.events.listen(request, 'error', this.loadFileFailed.bind(this, request,
      object));
  
  // listen to completed events
  goog.events.listen(request, 'load', this.loadFileCompleted.bind(this,
      request, object));
  
  // configure the URL
  request.open('GET', file, true);
  request.overrideMimeType("text/plain; charset=x-user-defined");
  request.setRequestHeader("Content-Type", "text/plain");
  
  // .. and GO!
  request.send(null);
  
  // add this loading job to our jobs map
  this.jobs_().set(object.id(), false);
  
};

X.loader.prototype.loadFileProgress = function(object, event) {

  if (event.lengthComputable) {
    var progress = event.loaded / event.total;
    
    this.addProgress(progress);
    
  }
  
};

X.loader.prototype.addProgress = function(value) {

  // we have a three stage system during loading
  //
  // stage 1: loading in X.loader
  // stage 2: parsing in X.parser (when loading textures, this does not happen
  // so the loading adds a 2 in total)
  // stage 3: setting up in X.renderer
  //
  // each stage adds progress from 0..1 with a total of 1 at the end
  this._progress_ += value / (this.jobs_().getCount()) / 3;
  
  if (this._progress_ > 1) {
    
    this._progress_ = 1;
    
  }
  
  var progressEvent = new X.event.ProgressEvent();
  progressEvent._value = this._progress_;
  this.dispatchEvent(progressEvent);
  
};


X.loader.prototype.progress = function() {

  return this._progress_;
  
};


X.loader.prototype.loadFileFailed = function(request, object) {

  throw new X.exception('Fatal: Could not get the file.');
  
};

X.loader.prototype.loadFileCompleted = function(request, object) {

  var file = object.file();
  
  var fileExtension = file.split('.').pop();
  
  // setup a parser depending on the fileExtension
  // at this point, we already know that the file format is supported
  
  if (fileExtension == 'stl') {
    
    var stlParser = new X.parserSTL();
    
    goog.events.listenOnce(stlParser, X.event.events.MODIFIED,
        this.parseFileCompleted.bind(this));
    
    stlParser.parse(object, request.response);
    
  } else if (fileExtension == 'vtk') {
    
    var vtkParser = new X.parserVTK();
    
    goog.events.listenOnce(vtkParser, X.event.events.MODIFIED,
        this.parseFileCompleted.bind(this));
    
    vtkParser.parse(object, request.response);
    
  } else if (fileExtension == 'trk') {
    
    var trkParser = new X.parserTRK();
    
    goog.events.listenOnce(trkParser, X.event.events.MODIFIED,
        this.parseFileCompleted.bind(this));
    
    trkParser.parse(object, request.response);
    
  }
  

};


X.loader.prototype.parseFileCompleted = function(event) {

  var object = event._object;
  
  // the parsing is done here..
  object.setClean();
  
  // fire the modified event
  object.modified();
  
  // mark the loading job as completed
  this.jobs_().set(object.id(), true);
  
};



// export symbols (required for advanced compilation)
goog.exportSymbol('X.loader', X.loader);