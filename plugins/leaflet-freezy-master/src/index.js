// Leaflet.Freezy

// import './styles.css'


L.Control.FreezeMapControl = L.Control.extend({
	// Container for all options value, initialized with the default values.
	options: {
		// Whether to immediately freeze the map when the control is added.
		freezeOnAdd: true,
		// Opacity of the map container when it's frozen.
		frozenMapOpacity: 0.5,
		// Thaw the map when hovering the cursor over it for a certain duration.
		// Default: Browser-dependent (see _browserHasScrollCaptureProtection)
		hoverToThaw: true,
		// Amount of time after which hovering thaws the map. [ms]
		hoverToThawDuration: 1000,
		// Freeze the map again when leaving the map container with the cursor for a certain
		// duration.
		leaveToFreeze: true,
		// Amount of time after which to freeze the map when the cursor has left the map container.
		// [ms]
		leaveToFreezeDuration: 2000,
		// Whether to display the 'Freeze' button when the map is thawed.
		freezeButtonWhenThawed: true,
		// Inner HTML of the 'Freeze' button.
		freezeButtonInnerHtml: '🔒',
		// Title (hover text) of the 'Freeze' button.
		freezeButtonTitle: 'Deactivate map',
		// Overlay content to show while the map is frozen. This can be either of:
		//   undefined: Use the plugin's standard text overlay
		//   function: Function to evaluate in order to obtain a DOM element tree.
		//   null: Disable the overlay
		frozenOverlay: undefined,
	},

	initialize: function(opts) {
		// Initialize options whose defaults depend on method calls
		this.options.hoverToThaw = this._browserHasScrollCaptureProtection();

		L.setOptions(this, opts);
	},

	onAdd: function(map) {
		this._map = map;

		this._freezeControl = this._makeFreezeControl();
		this._updateFreezeControl();	// Ensure we start off with the right CSS class

		this._frozenOverlay = this._makeFrozenOverlay();

		if (this.options.freezeOnAdd)
			this._freezeMap();
		else
			this._thawMap();

		return this._freezeControl;
	},

	onRemove: function(map) {
	},

	// Register a callback for a specific event.
	//
	// The following event keys are currently recognized:
	//   freeze: Called when the map is frozen.
	//   thaw:   Called when the map is thawed.
	// Callbacks receive no arguments and return values are ignored.
	//
	// Note that, if 'freezeOnAdd' is enabled, the initial freeze only invokes the callback if the
	// on() method is called before the map control is added to the map. In other words, use the
	// following sequence:
	//
	//   L.control.freezeMapControl(opts)
	//     .on('freeze', () => …)
	//     .addTo(map);
	//
	// The following would miss the initial freeze:
	//
	//   L.control.freezeMapControl(opts)
	//     .addTo(map)
	//     .on('freeze', () => …);
	on: function(event, callback) {
		if(event in this._callbacks)
		{
			this._callbacks[event].push(callback);
		}
		return this;
	},

	// Unregister a previously registered callback from a specific event.
	// See the on() function for a list of recognized event keys.
	off: function(event, callback) {
		if(event in this._callbacks)
		{
			this._callbacks[event] = this._callbacks[event].filter(cb => (cb != callback));
		}
		return this;
	},

	_map: null,
	_callbacks: {
		freeze: [],
		thaw: [],
	},
	_frozen: false,
	_frozenOverlay: null,
	_frozenOverlayOpacity: null,
	_freezeControl: null,
	_timeoutOver: null,
	_timeoutOut: null,

	_makeFreezeControl: function() {
		const freezeControl = L.DomUtil.create('div', 'leaflet-control-freeze leaflet-bar leaflet-control');
		const freezeControlButton = L.DomUtil.create('a', 'leaflet-control-freeze-button', freezeControl);
		freezeControlButton.role = 'button';
		freezeControlButton.href = '#';
		freezeControlButton.innerHTML = this.options.freezeButtonInnerHtml;
		freezeControlButton.title = this.options.freezeButtonTitle;
		L.DomEvent.on(freezeControlButton, 'click', this._onFreezeControlClicked, this);
		return freezeControl;
	},

	_updateFreezeControl: function() {
		const hideButton = !this.options.freezeButtonWhenThawed || this._frozen;
		L.DomUtil.addClass(this._freezeControl,
			hideButton ? 'leaflet-control-freeze-button-frozen' : 'leaflet-control-freeze-button-thawed'
		);
		L.DomUtil.removeClass(this._freezeControl,
			hideButton ? 'leaflet-control-freeze-button-thawed' : 'leaflet-control-freeze-button-frozen'
		);
	},

	// Note: This may only be called after we've been added to the map.
	_makeFrozenOverlay: function() {
		if(this.options.frozenOverlay === null) {
			return null;							// No overlay
		}
		if(typeof this.options.frozenOverlay === 'function') {
			return this.options.frozenOverlay();	// Custom overlay elements
		}

		const frozenNoteBox = L.DomUtil.create('div', 'leaflet-frozen-note-box', this._map.getContainer());
		const frozenNoteText = L.DomUtil.create('div', 'leaflet-frozen-note-text', frozenNoteBox);
		frozenNoteText.innerHTML = this.options.frozenOverlay
			? this.options.frozenOverlay			// Custom text
			: this._getFrozenOverlayText();			// Default text
		return frozenNoteBox;
	},

	_isTouch: function() {
		// Note that L.Browser.touchNative and .touch merely mean that touch control is _supported_
		// by the browser. We want to know whether touch control is the main input method. We use
		// "running on a mobile device" as a heuristic.
		// See: https://leafletjs.com/reference.html#browser
		return L.Browser.mobile;
	},

	_getFrozenOverlayText: function() {
		const clickyAction = this._isTouch() ? 'Tap' : 'Click';
		const maybeHover = this.options.hoverToThaw && !this._isTouch() ? ' or hover' : '';
		return `${clickyAction}${maybeHover} to activate`;
	},

	_browserHasScrollCaptureProtection: function() {
		// Some browsers have built-in protection against scroll capture. On such browsers it can
		// make sense to use different defaults. The following (incomplete) table summarizes the
		// situation:
		//
		// +-----------------------------+---------------------+
		// | Browser (engine)            | Built-in protection |
		// +-----------------------------+---------------------+
		// | Chromium 115 ①              | yes                 |
		// | Firefox 115                 | no                  |
		// | Safari 16.4                 | no                  |
		// | Edge 119                    | no                  |
		// +-----------------------------+---------------------+
		//
		// ① Tested: Ungoogled Chromium, Vivaldi, Brave
		return L.Browser.chrome;
	},

	_fireEvent: function(event) {
		for(const callback of this._callbacks[event])
			callback();
	},

	_freezeMap: function() {
		this._frozen = true;

		// Remove mouseout handler now that we're freezing
		this._map.off('mouseout', this._onThawedMapMouseOut, this);

		this._setMapEnabled(false);

		// Deactivate the map (make it partially transparent)
		L.DomUtil.setOpacity(this._map.getContainer(), this.options.frozenMapOpacity);

		// Show the frozen note (make it opaque)
		if(this._frozenOverlay) {
			L.DomUtil.setOpacity(this._frozenOverlay, this._frozenOverlayOpacity);
		}

		// Update freeze button visibility
		this._updateFreezeControl();

		// Map click handler for instant unfreezing
		L.DomEvent.on(this._map, 'click', this._onFrozenMapClicked, this);

		// Map mouseover handler for unfreezing after a timeout
		if(this.options.hoverToThaw) {
			this._map.once('mouseover', this._onFrozenMapMouseOver, this);
		}

		// Notify event handlers
		this._fireEvent('freeze');
	},

	_thawMap: function() {
		this._frozen = false;

		// Remove click handler and mouseover timeout now that we're thawing
		L.DomEvent.off(this._map, 'click', this._onFrozenMapClicked, this);
		clearTimeout(this._timeoutOver);

		this._setMapEnabled(true);

		// Activate the map (make it fully opaque)
		L.DomUtil.setOpacity(this._map._container, 1.0);

		// Hide the frozen note (make it fully transparent) but back up its current opacity, so that
		// we can restore it later.
		// TODO try to solve this using CSS but preserve the smooth transparency transition
		if(this._frozenOverlay) {
			this._frozenOverlayOpacity = this._frozenOverlay.style.opacity;
			L.DomUtil.setOpacity(this._frozenOverlay, 0);
		}

		// Update freeze button visibility
		this._updateFreezeControl();

		// Map mouseout handler for freezing after a timeout
		if(this.options.leaveToFreeze) {
			this._map.once('mouseout', this._onThawedMapMouseOut, this);
		}

		// Notify event handlers
		this._fireEvent('thaw');
	},

	_setMapEnabled: function(enabled) {
		// Make a list of controls to enable/disable
		var controls = [
			this._map.zoomControl,
			this._map.scrollWheelZoom,
			this._map.boxZoom,
			this._map.keyboard,
		];
		if (this._isTouch()) {
			controls.push(
				this._map.touchZoom,
				this._map.dragging,
			);
		}

		// Enable/disable all the controls
		for(const control of controls)
		{
			if(enabled)
				control.enable();
			else
				control.disable();
		}

		// Apply other changes
		this._map.getContainer().style.cursor = enabled ? 'grab' : 'default';
	},

	_onFrozenMapClicked: function(ev) {
		this._thawMap();
	},

	_onFrozenMapMouseOver: function(ev) {
		this._map.once('mouseout', this._onFrozenMapMouseOut, this);
		const self = this;
		this._timeoutOver = setTimeout(
			() => self._onFrozenMapMouseOverTimeout(),
			this.options.hoverToThawDuration
		);
	},

	_onFrozenMapMouseOut: function(ev) {
		clearTimeout(this._timeoutOver);
		this._map.once('mouseover', this._onFrozenMapMouseOver, this);
	},

	_onFrozenMapMouseOverTimeout: function(ev) {
		this._map.off('mouseout', this._onFrozenMapMouseOut, this);
		this._thawMap();
	},

	_onFreezeControlClicked: function(ev) {
		this._freezeMap();
		// _freezeMap() installs a click handler which would be triggered after we return, so we
		// need to stop propagation, e.g. using L.DomEvent.stopPropagation().
		// We also need to prevent jumping to '#', the button's href, e.g. using
		// L.DomEvent.preventDefault().
		// The call below performs both of those.
		L.DomEvent.stop(ev)
	},

	_onThawedMapMouseOut: function(ev) {
		this._map.once('mouseover', this._onThawedMapMouseOver, this);
		const self = this;
		this._timeoutOut = setTimeout(
			() => self._onThawedMapMouseOutTimeout(),
			this.options.leaveToFreezeDuration
		);
	},

	_onThawedMapMouseOver: function(ev) {
		clearTimeout(this._timeoutOut);
		this._map.once('mouseout', this._onThawedMapMouseOut, this);
	},

	_onThawedMapMouseOutTimeout: function(ev) {
		this._map.off('mouseover', this._onThawedMapMouseOver, this);
		this._freezeMap();
	},
});

L.control.freezeMapControl = (opts) => new L.Control.FreezeMapControl(opts);
