# Leaflet.Freezy

**Leaflet plugin to prevent unwanted scroll capturing.**

## Problem

Maps embedded in web pages have a habit of interfering with page scrolling.
Some projects have worked around this behavior by making users hold down the Ctrl key in order to zoom maps.
This can be annoying since it requires simultaneous use of the keyboard and the mouse.

Similarly, if a map is tall large enough to fill the screen on a mobile device, it can become impossible to perform page scrolling, an even more vexing usability problem.

While Chromium-based browsers have taken steps to mitigate the issue by suppressing mouse wheel and swiping input to maps while scrolling, other browsers (e.g. Firefox) still allow maps to aggressively capture scrolling control.

## Solution

*Leaflet.Freezy* is a [Leaflet](https://leafletjs.com/) plugin that provides a solution for these situations.
Its main features are:

- Lock interaction with ("freeze") maps on load until explicitly enabled.
- Allow users to manually freeze maps with the help of a _Freeze_ button.
- Unlock interaction with ("thaw") maps by clicking or tapping the map.
- Thaw maps by hovering over the map and re-freeze by moving the mouse pointer out of the map.

This plugin is a rewrite of the unmaintained and partially broken [Leaflet.Sleep](https://github.com/CliffCloud/Leaflet.Sleep) plugin.

## Demo

[Leaflet.Freezy Demo](https://mrubli.gitlab.io/leaflet-freezy/)

## Requirements

- **Leaflet:**
The plugin has mostly been tested with Leaflet 1.9 but strives to be compatible with earlier versions as well.
If you spot a problem, please [open an issue](https://gitlab.com/mrubli/leaflet-freezy/-/issues).
- **Browsers:**
There are no particular browser requirements.
The plugin has been tested with Chromium-based browsers ([Vivaldi](https://vivaldi.com/), [Brave](https://brave.com/), [Ungoogled Chromium](https://github.com/ungoogled-software/ungoogled-chromium), Edge) as well as Firefox and Safari.
Again, if you find a browser-specific issue, please open an issue.

## Usage

Changing a standard map into a frozen map is a one-liner:

```js
// Create a simple map using OpenStreetMap
var map = L.map('map-container')
    .setView([50.4024, 30.5313], 11)
    .addLayer(L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'));

// Add freeze logic and control to the map
L.control.freezeMapControl().addTo(map);
```

The above sample immediately freezes the map using the default freeze/thaw options.

You can also refer to the [source code](public/) of the [demo site](#demo) for a working example.

### Options

There are a number of options you can pass the `freezeMapControl()` constructor to adjust the behavior to your needs.
The following example shows all available options and their respective default values:

```js
L.control.freezeMapControl({
    // Whether to immediately freeze the map when the control is added.
    freezeOnAdd: true,
    // Opacity of the map container when it's frozen.
    frozenMapOpacity: 0.5,
    // Thaw the map when hovering the cursor over it for a certain duration.
    // Default: Browser-dependent (true for Chromium-based, false for others)
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
}).addTo(map);
```

### Callbacks

Callback functions can be registered to be notified when the map is frozen or thawed.
This is useful if other UI elements should be made to depend on the map frozen/thawed state:

```js
L.control.freezeMapControl()
    .on('freeze', () => console.log("🥶"))
    .on('thaw',   () => console.log("🥵"))
    .addTo(map);
```
