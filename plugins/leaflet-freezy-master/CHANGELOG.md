# Leaflet.Freezy change log

## 0.0.3 (2023-12-18)

### Improvements
* Added support for callbacks that are invoked when the map is frozen or thawed.
  Callback functions can be registered using the `on()` method and unregistered again using the `off()` method.

### Misc
* Fixed import by adding `main` field in `package.json`.
* Documentation fixes in [README.md](README.md).

## 0.0.2 (2023-12-10)

### Fixes
* Fixed frozen overlay showing on load when `freezeOnAdd` option is disabled.

### Improvements
* Set the `hoverToThaw` option's default value based on the browser.
  Some browsers (Chromium-based ones at the time of writing) have basic scroll capture protection built-in, so on those browsers `hoverToThaw: true` is the default.
  On other browsers the more aggressive `hoverToThaw: false` is used instead by default.
* Disable the Zoom +/− buttons when frozen.

### Misc
* Removed console log messages.
* Added usage examples to the [README.md](README.md) file.
* Various packaging-related improvements

## 0.0.1 (2023-11-15)

* Initial version
