// Apply the saved day/night choice before anything paints, so there's no flash of the wrong theme.
try { var t = (JSON.parse(localStorage.getItem('fuellog.settings.v1')) || {}).theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
