/**
 * # js2plot
 * 
 * Small library to plot 2D mathematical JavaScript functions in a canvas element with panning and
 * zooming. Written as part of a simple function plotter utility (http://arkanis.de/projects/js2plot/)
 * 
 * By Stephan Soller <stephan.soller@helionweb.de>, released under the MIT License.
 * 
 * 
 * ## Features
 * 
 * - You can write the functions directly in JavaScript. For more complex functions this is
 *   simpler than writing math expressions.
 * - Panning and zooming is handled by js2plot. You can freely move around in the plot and
 *   look at areas of interest.
 * - Triggers `plotchange` and `plotchangeend` events when the user interacts with the plot.
 * 
 * 
 * ## Usage example
 * 
 *     <!DOCTYPE html>
 *     <meta charset=utf-8>
 *     <title>js2plot example</title>
 *     
 *     <canvas id=plot width=512 height=256></canvas>
 *     <script src="js2plot.js"></script>
 *     <script>
 *         var plot = js2plot("canvas#plot", {
 *             base_size_ws: 4,
 *             grid_line_spacing_ws: Math.PI / 8,
 *             major_grid_line_interval: 4,
 *             axes_number_to_text: (n) => (n / Math.PI).toString() + "π"
 *         });
 *         plot.update(`
 *             var a = (x) => Math.sin(x);
 *             plot("green", a);
 *         `);
 *     </script>
 * 
 * 
 * ## Documentation
 * 
 * Call the `js2plot()` function to wrap a canvas element into a plot object. You can then plot different
 * JavaScript code with the plots `update()` function. See the documentation at the end of the
 * source code (the public interface).
 * 
 * The documentation and the source code use the notion of world space and view space coordinates.
 * View space is the coordinate system of the canvas. The origin is in the top left corner and the Y axis
 * grows downwards. Each unit is one pixel. Word space on the other hand is the mathematical coordiante
 * system used by the plotted functions. The origin is (by default) in the center of the canvas, the Y axis
 * grows upwards and the plot is `base_size_ws` units in size. The library uses the `_vs` and `_ws`
 * suffixes to make it clear which coordinate system a variable or option uses.
 * 
 * The js2plot() function itself takes 2 arguments:
 * 
 * canvas: Either an `HTMLCanvasElement` or a CSS selector (as string). If it's a string
 *     `document.querySelector()` will be called with the selector. The result is expected to be
 *     a canvas element.
 * 
 * options (optional): An object with settings for the plot.
 *   
 * - `base_size_ws`: The width in world space units that should at least be visible in the plot
 *       when not zoomed in or out (a `view_scale` of 1.0). The scale is calcuated based on the
 *       canvases width or height (whichever is smaller). Default: `10`.
 *   
 * - `grid_line_spacing_ws`: The distance (in world space units) between grid lines at a `view_scale`
 *       of `1.0` (not zoomed in or out). Default: `1/5` (5 grid lines for every world space unit).
 *   
 * - `major_grid_line_interval`: Show a major grid line every n minor grid lines. Default: `5` (one
 *       major grid line every 5 minor grid lines).
 *   
 * - `plot_step_size_vs`: The step size in view space units (canvas pixels) that is used when drawing
 *       function plots. Default: `2` (a function is drawn as a line with one point every 2 pixels).
 *   
 * - `view_scale`: The scale representing the initial user zoom. See the `scale()` function at the end
 *       for more details. Default `1.0` (not zoomed in or out).
 *   
 * - `view_center_ws`: The initial center of the plot in world space coordinates. See the `center()` function
 *       at the end for more details. Default: `{x: 0, y: 0}` (the origin is shown at the center of the canvas).
 *   
 * - `axes_number_to_text`: A function that takes a number and returns a string. Each number drawn
 *       at the axes is passed through this function. You can use it to format those numbers in a special
 *       way. Default: Calls `toString()` on the number.
 * 
 * 
 * ## Events
 * 
 * js2plot fires several events on the canvas element when the plot has changed.
 * 
 * When the user pans the view a `plotchange` event is fired for every mousemove. At the end of
 * panning a `plotchangeend` event is fired (when the mouse button is released). `plotchangeend` is
 * also fired when the user zooms in or out with the mouse wheel or when the `update()` function is done.
 * 
 * These events signal that the plots state has changed. You can use the `scale()` and `center()`
 * functions of the plot object to read the current state (and e.g. save it).
 */
function js2plot(canvas, options) {
	//
	// Settings
	//
	if (options === undefined)
		options = {};
	var base_size_ws = (options.base_size_ws !== undefined) ? options.base_size_ws : 10;
	var grid_line_spacing_ws = (options.grid_line_spacing_ws !== undefined) ? options.grid_line_spacing_ws : 1/5;
	var major_grid_line_interval = (options.major_grid_line_interval !== undefined) ? options.major_grid_line_interval : 5;
	var plot_step_size_vs = (options.plot_step_size_vs !== undefined) ? options.plot_step_size_vs : 2;
	var axes_number_to_text = (options.axes_number_to_text !== undefined) ? options.axes_number_to_text : function(n){
		return n.toString();
	};
	
	//
	// State of the plot
	//
	var view_scale = (options.view_scale !== undefined) ? options.view_scale : 1.0;
	var view_center_ws = (options.view_center_ws !== undefined) ? options.view_center_ws : { x: 0, y: 0 };
	
	var ctx = (typeof canvas == "string" ? document.querySelector(canvas) : canvas).getContext("2d");
	var last_working_user_code_function = null;
	
	
	//
	// Code for transformation between world and view space
	//
	
	// World to view space scale: A world space distance multiplied with this value gives us the view space distance.
	// It is only changed by updateCanvasSizeAndRedraw().
	var ws_to_vs_scale = 1.0;
	
	// Transformations from world space to view space and back (for x and y)
	function x_ws_to_vs(x_ws) {
		return (ctx.canvas.width / 2) + (x_ws - view_center_ws.x) * ws_to_vs_scale * 1;
	}
	function y_ws_to_vs(y_ws) {
		return (ctx.canvas.height / 2) + (y_ws - view_center_ws.y) * ws_to_vs_scale * -1;
	}
	function x_vs_to_ws(x_vs) {
		return view_center_ws.x + (x_vs - ctx.canvas.width / 2) / ws_to_vs_scale * 1;
	}
	function y_vs_to_ws(y_vs) {
		return view_center_ws.y + (y_vs - ctx.canvas.height / 2) / ws_to_vs_scale * -1;
	}
	
	
	//
	// Drawing code
	//
	
	/**
	 * This function is the central piece of code that is called whenever something changed.
	 * It resizes the canvas so we have one canvas pixel for one CSS pixel and then redraws
	 * the entire plot.
	 * 
	 * It returns `null` if everything went fine (no error). If the user code caused an exception
	 * the Error object of it is returned.
	 */
	function updateCanvasSizeAndRedraw(user_code_function) {
		// Set the canvas drawing size to the actual display size (one canvas pixel for one
		// CSS pixel). We do that in case the sidebar or window width changed (and with
		// that the CSS size of the canvas). Setting the canvas dimensions also clears the
		// canvas to white, even if we set it to the same dimensions as before.
		ctx.canvas.width = ctx.canvas.clientWidth;
		ctx.canvas.height = ctx.canvas.clientHeight;
		
		// Calculate a new ws_to_vs_scale because the size of the canvas element might have changed.
		// It is created by multiplying two scales (base_scale and view_scale): The first is the scale needed
		// to get base_size_ws world space units within the canvas width or height (whichever is smaller).
		// The second is the scale defining how much the user zoomed in or out.
		var base_scale = Math.min(ctx.canvas.width, ctx.canvas.height) / base_size_ws;
		ws_to_vs_scale = base_scale * view_scale;
		
		// Redraw then entire plot
		drawGridAndAxes();
		if ( typeof user_code_function === "function" ) {
			try {
				user_code_function(drawFunction);
			} catch(e) {
				return e;
			}
		}
		return null;
	}
	
	/**
	 * A helper function for updateCanvasSizeAndRedraw() to make the code there better
	 * readable. It is only used there.
	 */
	function drawGridAndAxes() {
		// Calculate the limits of the view in world space (note that y min is at the bottom of the view
		// and max is at the top because y is flipped)
		var x_min_ws = x_vs_to_ws(0), x_max_ws = x_vs_to_ws(ctx.canvas.width - 1);
		var y_min_ws = y_vs_to_ws(ctx.canvas.height - 1), y_max_ws = y_vs_to_ws(0);
		
		// Draw minor gird lines
		ctx.beginPath();
		ctx.strokeStyle = "hsl(0, 0%, 90%)"; 
		ctx.lineWidth = 1;
		// Scale the grid line spacing by the closest power of two scale. For that we have to represent the scale (e.g. 0.2)
		// as a 2^x exponent (e.g. -2.31), round the exponent (e.g. -2) and then convert it back to a scale (e.g. 0.25).
		var minor_grid_line_spacing_ws = grid_line_spacing_ws / Math.pow(2, Math.round(Math.log2(view_scale)));
		
		for(var n = Math.floor(x_min_ws / minor_grid_line_spacing_ws); n <= Math.ceil(x_max_ws / minor_grid_line_spacing_ws); n++) {
			var grid_x_vs = Math.round(x_ws_to_vs(n * minor_grid_line_spacing_ws)) + 0.5;
			ctx.moveTo(grid_x_vs, 0);
			ctx.lineTo(grid_x_vs, ctx.canvas.height);
		}
		
		for(var n = Math.floor(y_min_ws / minor_grid_line_spacing_ws); n <= Math.ceil(y_max_ws / minor_grid_line_spacing_ws); n++) {
			var grid_y_vs = Math.round(y_ws_to_vs(n * minor_grid_line_spacing_ws)) + 0.5;
			ctx.moveTo(0, grid_y_vs);
			ctx.lineTo(ctx.canvas.width, grid_y_vs);
		}
		
		ctx.stroke();
		
		// Draw major grid lines and labels
		ctx.beginPath();
		ctx.strokeStyle = "hsl(0, 0%, 80%)"; 
		ctx.lineWidth = 1;
		var major_grid_line_spacing_ws = minor_grid_line_spacing_ws * major_grid_line_interval;
		
		for(var n = Math.floor(x_min_ws / major_grid_line_spacing_ws); n <= Math.ceil(x_max_ws / major_grid_line_spacing_ws); n++) {
			var grid_x_vs = Math.round(x_ws_to_vs(n * major_grid_line_spacing_ws)) + 0.5;
			ctx.moveTo(grid_x_vs, 0);
			ctx.lineTo(grid_x_vs, ctx.canvas.height);
		}
		
		for(var n = Math.floor(y_min_ws / major_grid_line_spacing_ws); n <= Math.ceil(y_max_ws / major_grid_line_spacing_ws); n++) {
			var grid_y_vs = Math.round(y_ws_to_vs(n * major_grid_line_spacing_ws)) + 0.5;
			ctx.moveTo(0, grid_y_vs);
			ctx.lineTo(ctx.canvas.width, grid_y_vs);
		}
		
		ctx.stroke();
		
		// Draw axes
		ctx.beginPath();
		ctx.strokeStyle = "black"; 
		ctx.lineWidth = 1;
		
		var axis_x_vs = Math.round(x_ws_to_vs(0)) + 0.5;
		ctx.moveTo(axis_x_vs, 0);
		ctx.lineTo(axis_x_vs, ctx.canvas.height);
		var axis_y_vs = Math.round(y_ws_to_vs(0)) + 0.5;
		ctx.moveTo(0, axis_y_vs);
		ctx.lineTo(ctx.canvas.width, axis_y_vs);
		
		ctx.stroke();
		
		// Draw numbers along axes at every major grid line
		var font_size = 13;
		ctx.font = font_size + "px sans-serif";
		var line_height = font_size * 1.5;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "gray";
		ctx.strokeStyle = "white";
		ctx.lineWidth = 4;
		
		var axes_y_vs = y_ws_to_vs(0) + line_height / 2;
		var axes_x_vs = x_ws_to_vs(0) - line_height / 5;
		
		for(var n = Math.floor(x_min_ws / major_grid_line_spacing_ws); n <= Math.ceil(x_max_ws / major_grid_line_spacing_ws); n++) {
			if (n == 0)
				continue;
			
			var x_vs = Math.round(x_ws_to_vs(n * major_grid_line_spacing_ws)) + 0.5;
			var y_vs = axes_y_vs;
			var text = axes_number_to_text(n * major_grid_line_spacing_ws);
			ctx.strokeText(text, x_vs, y_vs);
			ctx.fillText(text, x_vs, y_vs);
		}
		
		ctx.textAlign = "right";
		for(var n = Math.floor(y_min_ws / major_grid_line_spacing_ws); n <= Math.ceil(y_max_ws / major_grid_line_spacing_ws); n++) {
			if (n == 0)
				continue;
			
			var y_vs = Math.round(y_ws_to_vs(n * major_grid_line_spacing_ws)) + 0.5;
			var x_vs = axes_x_vs;
			var text = axes_number_to_text(n * major_grid_line_spacing_ws);
			ctx.strokeText(text, x_vs, y_vs);
			ctx.fillText(text, x_vs, y_vs);
		}
		
		var x_vs = axes_x_vs;
		var y_vs = axes_y_vs;
		ctx.strokeText("0", x_vs, y_vs);
		ctx.fillText("0", x_vs, y_vs);
	}
	
	/**
	 * This function draws the plot for one 2D function. It is made available to the user JavaScript
	 * code under the name "plot". It takes its parameters in any order. What an argument does
	 * depends on its type:
	 * 
	 * function: Plots the graph of that function. It is called for each x value and has to return
	 *     the corresponding y value.
	 * string (e.g. "red" or "hsla(210, 50%, 50%, 0.25)"): The graph will be drawn in that
	 *     color (default "blue").
	 * number (e.g. 2): It is used as the line width in pixels for the graph (default 1).
	 * array (e.g. [10, 5]): It is used to dash lines of the graph. The elements specify distances
	 *     to alternately draw a line and a gap in pixels. See setLineDash.
	 */
	function drawFunction(var_args) {
		var func = null, color = "blue", width = 1, dash_pattern = [];
		for(var i = 0; i < arguments.length; i++) {
			if ( typeof arguments[i] == "function" )
				func = arguments[i];
			else if ( typeof arguments[i] == "string" )
				color = arguments[i];
			else if ( typeof arguments[i] == "number" )
				width = arguments[i];
			else if ( Array.isArray(arguments[i]) )
				dash_pattern = arguments[i];
		}
		
		if (func === null)
			return;
		
		ctx.beginPath();
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.setLineDash(dash_pattern);
		
		for(var x_vs = 0; x_vs < ctx.canvas.width; x_vs += plot_step_size_vs) {
			var x_ws = x_vs_to_ws(x_vs);
			var y_ws = func(x_ws);
			var y_vs = y_ws_to_vs(y_ws);
			
			if (x_vs == 0)
				ctx.moveTo(x_vs, y_vs);
			else
				ctx.lineTo(x_vs, y_vs);
		}
		
		ctx.stroke();
	}
	
	
	//
	// Event handling
	//
	
	// When the mouse button is down this variable contains the last mouse position (as an
	// { x: ..., y: ... } object). Otherwise it is set to `null`.
	var last_mouse_pos = null;
	
	// Pan the view with mouse drag
	ctx.canvas.addEventListener("mousedown", function(event){
		if (event.target == ctx.canvas) {
			last_mouse_pos = { x: event.pageX, y: event.pageY };
			event.stopPropagation();
			event.preventDefault();
		}
	});
	document.addEventListener("mousemove", function(event){
		if (last_mouse_pos) {
			var dx_vs = event.pageX - last_mouse_pos.x;
			var dy_vs = event.pageY - last_mouse_pos.y;
			last_mouse_pos.x = event.pageX;
			last_mouse_pos.y = event.pageY;
			
			// Pan the view by changing the current world space viewport center depending
			// on the distance the mouse was moved and the current world space to view space
			// scale. Note that the Y axis is inverted because in mathematics it goes up (world
			// space) but in the pageY coordinates it goes down (view space).
			view_center_ws.x -= dx_vs / ws_to_vs_scale * 1;
			view_center_ws.y -= dy_vs / ws_to_vs_scale * -1;
			updateCanvasSizeAndRedraw(last_working_user_code_function);
			ctx.canvas.dispatchEvent(new Event("plotchange"));
			
			event.stopPropagation();
			event.preventDefault();
		}
	});
	document.addEventListener("mouseup", function(event){
		if (last_mouse_pos) {
			last_mouse_pos = null;
			ctx.canvas.dispatchEvent(new Event("plotchangeend"));
			event.stopPropagation();
			event.preventDefault();
		}
	});
	
	// Zoom in or out with the mouse wheel
	ctx.canvas.addEventListener("wheel", function(event){
		// Calculate cross-browser offsetX and offsetY. Older Firefox versions don't support them
		// as properties of the event object.
		var bb = this.getBoundingClientRect();
		var offsetX = event.pageX - bb.left, offsetY = event.pageY - bb.top;
		
		var scale_multiplier = (event.deltaY > 0) ? 0.9 /* zoom out */ : 1 / 0.9 /* zoom in */;
		var scale_old = ws_to_vs_scale;
		var scale_new = ws_to_vs_scale * scale_multiplier;
		
		// Update the world space view center in a way that the position directly under the
		// mouse pointer stays where it is. To the user this appears as zooming in or out of
		// the region where the mouse currently is at.
		// Mathematically the idea is to move the world space view center closer to the world
		// space mouse position (zoom in) or farther away from it (zoom out). How much depends
		// on the ratio between the old and new scale.
		var point_x_ws = x_vs_to_ws(offsetX), point_y_ws = y_vs_to_ws(offsetY);
		var view_center_old = view_center_ws;
		var view_center_new = {
			x: point_x_ws + (view_center_old.x - point_x_ws) * (scale_old / scale_new),
			y: point_y_ws + (view_center_old.y - point_y_ws) * (scale_old / scale_new)
		};
		
		view_center_ws = view_center_new;
		view_scale *= scale_multiplier;
		updateCanvasSizeAndRedraw(last_working_user_code_function);
		ctx.canvas.dispatchEvent(new Event("plotchange"));
		ctx.canvas.dispatchEvent(new Event("plotchangeend"));
		
		event.stopPropagation();
		event.preventDefault();
	});
	
	
	//
	// Public interface
	//
	return {
		/**
		 * Redraw the plot, optionally with new JavaScript code from the user. When called without
		 * an argument it just redraws the plot. When called with one string argument the string is
		 * used as JavaScript code and the plot is redrawn with that code.
		 * 
		 * If everything went fine `null` is returned (no error). If the code contained errors the Error
		 * object of the exception is returned (e.g. a TypeError for an unknown function name).
		 */
		update: function(new_code){
			var error = null;
			if (typeof new_code === "string") {
				// Try to compile and plot new user code, remember the error if one of those
				// two steps goes wrong.
				try {
					var new_code_function = Function("plot", new_code);
					error = updateCanvasSizeAndRedraw(new_code_function);
				} catch(e) {
					error = e;
				}
				
				if (error === null) {
					// Plotting new user code worked fine, use it for all future redraws
					last_working_user_code_function = new_code_function;
				} else {
					// Failed to plot new user code, restore old canvas (redraw with old code)
					updateCanvasSizeAndRedraw(last_working_user_code_function);
				}
			} else {
				// No argument, just redraw with existing user code
				error = updateCanvasSizeAndRedraw(last_working_user_code_function);
			}
			
			ctx.canvas.dispatchEvent(new Event("plotchangeend"));
			return error;
		},
		
		/**
		 * Returns or sets the current scale representing the users zoom. It's larger than 1 when
		 * the user zoomed in and smaller than 1 (but never 0) when the user zoomed out.
		 * 
		 * When the function is called without an argument the current scale is returned. When it
		 * is called with one number argument the current scale is set to this value but the plot is
		 * not redrawn. You have to call update() for that.
		 * 
		 * For example a scale of 2.0 shows the plot twice as large as 1.0 (zoomed in).
		 * A scale of 0.5 shows the plot twice as small as 1.0 (zoomed out).
		 */
		scale: function(new_scale){
			if (typeof new_scale === "number") {
				view_scale = new_scale;
				return this;
			} else {
				return view_scale;
			}
		},
		
		/**
		 * Returns or sets the current center of the view (expressed in world space coordinates).
		 * 
		 * When the function is called without arguments it returns the current center as an
		 * `{ x: ..., y: ... }` object. When it's called with two number arguments the current center
		 * is set to these coordinates (x and y) but the plot is not redawn (call update() for that).
		 * 
		 * For example when the center is {x: 0, y: 0} the origin of the plot is shown at the center
		 * of the canvas. If it's {x: 3.141, y: 0} this world space position is shown at the center of
		 * the canvas.
		 */
		center: function(new_view_center_x, new_view_center_y){
			if (typeof new_view_center_x === "number" && typeof new_view_center_y === "number") {
				view_center_ws = { x: new_view_center_x, y: new_view_center_y };
				return this;
			} else {
				return { x: view_center_ws.x, y: view_center_ws.y };
			}
		}
	};
}