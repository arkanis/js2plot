function plotter(canvas, options) {
	var base_width_ws = 10;
	var grid_line_spacing_ws = 1/5;
	var major_grid_lines_every_n = 5;
	var plot_step_size_vs = 2;
	
	var view_scale = 1.0;
	var view_center_ws = { x: 0, y: 0 };
	
	var ctx = (typeof canvas == "string" ? document.querySelector(canvas) : canvas).getContext("2d");
	var parsed_code = null;
	
	
	/**
	 * Settings:
	 * 	world space base size (in ws units)
	 * 	grid line spacing (in ws units at scale 1.0)
	 * 	label spacing (on every nth grid line)
	 * 	view space step size (in px)
	 * Update canvas dimensions and clear canvas
	 * Space:
	 * 	Calculate scale (needed for transformation between world and view space)
	 * 	Calculate limits of of view in world_space (x min/max, y min/max)
	 * Draw grid
	 * 	Grid line interval: Grid line every n ws units / scale (so we get a grid line every 2 ws units when scale is 0.5)
	 * 	Start line: Round down to get start grid line
	 * 	End line: Round up to get end grid line
	 * 	Axes: Draw axes lines in black at x/y world space = 0
	 * 	Labels: On axes on every n grid line?
	 * 		Calc start and end index for x/y labels and draw text for them
	 * 		One pass for x, one for y labels
	 * Call user code to plot functions
	 * 	Plot user function:
	 * 		Iterate from view space x min (0) to x max (canvas width - 1) with view space step size
	 * 		Translate x to world space
	 * 		Calculate world space y for world space x
	 * 		Translate world space y to view space
	 * 		Draw line segments between world space points
	 */
	function draw() {
		// Set the canvas drawing size to the actual display size. In case the sidebar
		// or window width changed. This also clears the canvas to white.
		ctx.canvas.width = ctx.canvas.clientWidth;
		ctx.canvas.height = ctx.canvas.clientHeight;
		
		// World to view space scale: A world space distance multiplied with this value gives us the view space distance.
		// The first term is the scale needed to get base_width_ws world space units within the smallest canvas dimension (width or height).
		var base_scale = Math.min(ctx.canvas.width, ctx.canvas.height) / base_width_ws;
		var ws_to_vs_scale = base_scale * view_scale;
		// Transformations from world space to view space and back (for x and y)
		function x_ws_to_vs(x_ws) { return (ctx.canvas.width / 2) + (x_ws - view_center_ws.x) * ws_to_vs_scale * 1; }
		function y_ws_to_vs(y_ws) { return (ctx.canvas.height / 2) + (y_ws - view_center_ws.y) * ws_to_vs_scale * -1; }
		function x_vs_to_ws(x_vs) { return view_center_ws.x + (x_vs - ctx.canvas.width / 2) / ws_to_vs_scale * 1; }
		function y_vs_to_ws(y_vs) { return view_center_ws.y + (y_vs - ctx.canvas.height / 2) / ws_to_vs_scale * -1; }
		
		// Calculate the limits of the view in world space (note that y min is at the bottom of the view and max is at the top because y is flipped)
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
		var major_grid_line_spacing_ws = minor_grid_line_spacing_ws * major_grid_lines_every_n;
		
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
			var text = n * major_grid_line_spacing_ws;
			ctx.strokeText(text, x_vs, y_vs);
			ctx.fillText(text, x_vs, y_vs);
		}
		
		ctx.textAlign = "right";
		for(var n = Math.floor(y_min_ws / major_grid_line_spacing_ws); n <= Math.ceil(y_max_ws / major_grid_line_spacing_ws); n++) {
			if (n == 0)
				continue;
			
			var y_vs = Math.round(y_ws_to_vs(n * major_grid_line_spacing_ws)) + 0.5;
			var x_vs = axes_x_vs;
			var text = n * major_grid_line_spacing_ws;
			ctx.strokeText(text, x_vs, y_vs);
			ctx.fillText(text, x_vs, y_vs);
		}
		
		var x_vs = axes_x_vs;
		var y_vs = axes_y_vs;
		ctx.strokeText("0", x_vs, y_vs);
		ctx.fillText("0", x_vs, y_vs);
		
		// Draw graphs
		function plot() {
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
		if (parsed_code !== null)
			parsed_code(plot);
		return null;
	}
	
	var mouse_down = false, last_pos = { x: 0, y: 0 };
	ctx.canvas.addEventListener("mousedown", function(event){
		if (event.target == ctx.canvas) {
			mouse_down = true;
			last_pos.x = event.pageX;
			last_pos.y = event.pageY;
			event.stopPropagation();
			event.preventDefault();
		}
	});
	document.addEventListener("mousemove", function(event){
		if (mouse_down) {
			var dx_vs = event.pageX - last_pos.x;
			var dy_vs = event.pageY - last_pos.y;
			last_pos.x = event.pageX;
			last_pos.y = event.pageY;
			
			// A reason to make the scale available as state variable
			var base_scale = Math.min(ctx.canvas.width, ctx.canvas.height) / base_width_ws;
			var ws_to_vs_scale = base_scale * view_scale;
			
			view_center_ws.x -= dx_vs / ws_to_vs_scale * 1;
			view_center_ws.y -= dy_vs / ws_to_vs_scale * -1;
			draw();
			
			event.stopPropagation();
			event.preventDefault();
		}
	});
	ctx.canvas.addEventListener("mouseup", function(event){
		if (mouse_down) {
			mouse_down = false;
			event.stopPropagation();
			event.preventDefault();
		}
	});
	
	ctx.canvas.addEventListener("wheel", function(event){
		// A reason to make the scale available as state variable
		var base_scale = Math.min(ctx.canvas.width, ctx.canvas.height) / base_width_ws;
		var ws_to_vs_scale = base_scale * view_scale;
		function x_vs_to_ws(x_vs) { return view_center_ws.x + (x_vs - ctx.canvas.width / 2) / ws_to_vs_scale * 1; }
		function y_vs_to_ws(y_vs) { return view_center_ws.y + (y_vs - ctx.canvas.height / 2) / ws_to_vs_scale * -1; }
		
		var scale_multiplier = (event.deltaY > 0) ? 0.9 /* zoom out */ : 1 / 0.9 /* zoom in */;
		var scale_old = ws_to_vs_scale;
		var scale_new = ws_to_vs_scale * scale_multiplier;
		
		var point_x_ws = x_vs_to_ws(event.offsetX), point_y_ws = y_vs_to_ws(event.offsetY);
		var view_center_old = view_center_ws;
		var view_center_new = {
			//x: view_center_old.x + (point_x_ws - view_center_old.x) * (1 - (scale_old / scale_new)),
			//y: view_center_old.y + (point_y_ws - view_center_old.y) * (1 - (scale_old / scale_new))
			x: point_x_ws + (view_center_old.x - point_x_ws) * (scale_old / scale_new),
			y: point_y_ws + (view_center_old.y - point_y_ws) * (scale_old / scale_new)
		};
		
		view_center_ws = view_center_new;
		view_scale *= scale_multiplier;
		draw();
	});
	
	return {
		update: function(code){
			//draw();
			
			// If the code contains errors we don't want to change the plot.
			// So try to parse it first before clearing the plot.
			try {
				parsed_code = Function("plot", code);
			} catch(e) {
				console.error(e);
				return e.toString();
			}
			return draw();
		}
	};
}