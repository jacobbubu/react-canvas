'use strict';

var React = require('react');
var assign = require('react/lib/Object.assign');
var createComponent = require('./createComponent');
var LayerMixin = require('./LayerMixin');
var Layer = require('./Layer');
var Group = require('./Group');
var ImageCache = require('./ImageCache');
var Easing = require('./Easing');
var clamp = require('./clamp');
var EventTypes = require('./EventTypes');

var FADE_DURATION = 200;

var RawImage = createComponent('Image', LayerMixin, {

  applyImageProps: function (prevProps, props) {
    var layer = this.node;

    layer.type = 'image';
    layer.imageUrl = props.src;
  },

  mountComponent: function (rootID, transaction, context) {
    var props = this._currentElement.props;
    var layer = this.node;
    this.applyLayerProps({}, props);
    this.applyImageProps({}, props);
    return layer;
  },

  receiveComponent: function (nextComponent, transaction, context) {
    var prevProps = this._currentElement.props;
    var props = nextComponent.props;
    this.applyLayerProps(prevProps, props);
    this.applyImageProps({}, props);
    this._currentElement = nextComponent;
    this.node.invalidateLayout();
  },

});

var Image = React.createClass({

  propTypes: {
    src: React.PropTypes.string.isRequired,
    style: React.PropTypes.object,
    useBackingStore: React.PropTypes.bool,
    fadeIn: React.PropTypes.bool,
    fadeInDuration: React.PropTypes.number,
    onLoaded: React.PropTypes.func,
    onFadeInDone: React.PropTypes.func
  },

  getInitialState: function () {
    var loaded = ImageCache.get(this.props.src).isLoaded();
    return {
      loaded: loaded,
      imageAlpha: loaded ? 1 : 0
    };
  },

  loadEvents: function (props) {
    ImageCache.get(props.src).on('load', this.handleImageLoad);
    ImageCache.get(props.src).on('error', this.handleImageLoadError);
  },

  unloadEvents: function (props) {
    ImageCache.get(props.src).removeListener('load', this.handleImageLoad);
    ImageCache.get(props.src).removeListener('error', this.handleImageLoadError);
  },

  componentDidMount: function () {
    this.loadEvents(this.props)
  },

  componentWillUnmount: function () {
    if (this._pendingAnimationFrame) {
      cancelAnimationFrame(this._pendingAnimationFrame);
    }
    this.unloadEvents(this.props)
  },

  componentDidUpdate: function (prevProps, prevState) {
    if (prevProps.src !== this.props.src) {
      this.unloadEvents(prevProps);
      this.loadEvents(this.props);
    }
    if (this.refs.image) {
      this.refs.image.invalidateLayout();
    }
  },

  render: function () {
    var rawImage;
    var imageStyle = assign({}, this.props.style);
    var style = assign({}, this.props.style);
    var backgroundStyle = assign({}, this.props.style);
    var useBackingStore = this.state.loaded ? this.props.useBackingStore : false;
    var groupProps = {ref: 'main'};

    // Hide the image until loaded.
    imageStyle.alpha = this.state.imageAlpha;

    // Hide opaque background if image loaded so that images with transparent
    // do not render on top of solid color.
    style.backgroundColor = imageStyle.backgroundColor = null;
    backgroundStyle.alpha = clamp(1 - this.state.imageAlpha, 0, 1);

    groupProps.style = style;

    for (var type in EventTypes) {
      if (this.props[type]) groupProps[type] = this.props[type];
    }

    return (
      React.createElement(Group, groupProps,
        React.createElement(Layer, {ref: 'background', style: backgroundStyle}),
        React.createElement(RawImage, {ref: 'image', src: this.props.src, style: imageStyle, useBackingStore: useBackingStore})
      )
    );
  },

  handleImageLoadError: function (e) {
    if (this.props.onError) this.props.onError(e);
  },

  handleImageLoad: function () {
    var imageAlpha = 1;
    if (this.props.fadeIn) {
      imageAlpha = 0;
      this._animationStartTime = Date.now();
      this._pendingAnimationFrame = requestAnimationFrame(this.stepThroughAnimation);
    }
    this.setState({ loaded: true, imageAlpha: imageAlpha });
    if (this.props.onLoaded) this.props.onLoaded(this.props.src);
  },

  stepThroughAnimation: function () {
    var fadeInDuration = this.props.fadeInDuration || FADE_DURATION;
    var alpha = Easing.easeInCubic((Date.now() - this._animationStartTime) / fadeInDuration);
    alpha = clamp(alpha, 0, 1);
    this.setState({ imageAlpha: alpha });
    if (alpha < 1) {
      this._pendingAnimationFrame = requestAnimationFrame(this.stepThroughAnimation);
    } else {
      if (this.props.onFadeInDone) this.props.onFadeInDone(this.props.src);
    }
  }

});

module.exports = Image;
