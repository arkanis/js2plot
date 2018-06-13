# js2plot

Small library to plot 2D mathematical JavaScript functions in a canvas element with panning and
zooming. Written as part of a simple function plotter utility (http://arkanis.de/projects/js2plot/)

By Stephan Soller <stephan.soller@helionweb.de>, released under the MIT License.


## Features

- You can write the functions directly in JavaScript. For more complex functions this is
  simpler than writing math expressions.
- Panning and zooming is handled by js2plot. You can freely move around in the plot and
  look at areas of interest.
- Triggers "plotchange" and "plotchangeend" events when the user interacts with the plot.


## Usage example

    <!DOCTYPE html>
    <meta charset=utf-8>
    <title>js2plot example</title>
    
    <canvas id=plot width=512 height=256></canvas>
    <script src="js2plot.js"></script>
    <script>
        var plot = js2plot("canvas#plot", {
            base_size_ws: 4,
            grid_line_spacing_ws: Math.PI / 8,
            major_grid_line_interval: 4,
            axes_number_to_text: (n) => (n / Math.PI).toString() + "π"
        });
        plot.update(`
            var a = (x) => Math.sin(x);
            plot("green", a);
        `);
    </script>


## Documentation

Call the js2plot() function to wrap a canvas element into a plot. You can then plot different
JavaScript code with the plots update() function. See the documentation at the end of the
source code (the public interface).

The js2plot() function itself takes 2 arguments:

canvas: Either an HTMLCanvasElement or a CSS selector (as string). If it's a string
    document.querySelector() will be called with the selector. The result is expected to be
    a canvas element.

options (optional): An object with settings for the plot.
  
- base_size_ws: The width in world space units that should at least be visible in the plot
      when not zoomed in or out (a view_scale of 1.0). The scale is calcuated based on the
      canvases width or height (whichever is smaller). Default: 10.
  
- grid_line_spacing_ws: The distance (in world space units) between grid lines at a view_scale
      of 1.0 (not zoomed in or out). Default: 1/5 (5 grid lines for every world space unit).
  
- major_grid_line_interval: Show a major grid line every n minor grid lines. Default: 5 (one
      major grid line every 5 minor grid lines).
  
- plot_step_size_vs: The step size in view space units (canvas pixels) that is used when drawing
      function plots. Default: 2 (a function is drawn as a line with one point every 2 pixels).
  
- view_scale: The scale representing the initial user zoom. See the scale() function at the end
      for more details. Default 1.0 (not zoomed in or out).
  
- view_center_ws: The initial center of the plot in world space coordinates. See the center() function
      at the end for more details. Default: 0, 0 (the origin is shown at the center of the canvas).
  
- axes_number_to_text: A function that takes a number and returns a string. Each number drawn
      at the axes is passed through this function. You can use it to format those numbers in a special
      way. Default: Calls toString() on the number.


## Events

js2plot fires several events on the canvas element when the plot has changed.

When the user pans the view a "plotchange" event is fired for every mousemove. At the end of
panning a "plotchangeend" event is fired (when the mouse button is released). "plotchangeend" is
also fired when the user zooms in or out with the mouse wheel or when the update() function is done.

These events signal that the plots state has changed. You can use the `scale()` and `center()`
functions of the plot object to read the current state (and e.g. save it).