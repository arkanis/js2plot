function plotter(canvas, options) {
	var ctx = (typeof canvas == "string" ? document.querySelector(canvas) : canvas).getContext("2d");
	var translation_ws = { x: 0, y: 0 };
	var parsed_code = null;
	
	var axes = {
		x0: 0.5 + 0.5 * ctx.canvas.width,  // x0 pixels from left to x=0
		y0: 0.5 + 0.5 * ctx.canvas.height,  // y0 pixels from top to y=0
		scale: 40
	};
	
	function draw() {
		// Set the canvas drawing size to the actual display size. In case the sidebar
		// or window width changed. This also clears the canvas.
		ctx.canvas.width = ctx.canvas.clientWidth;
		ctx.canvas.height = ctx.canvas.clientHeight;
		
		showAxes();
		if (parsed_code !== null)
			parsed_code(plot);
		return null;
	}

	function plot(func, color, thick) {
		var xx, yy, dx=4, x0=axes.x0, y0=axes.y0, scale=axes.scale;
		
		x0 += translation_ws.x;
		y0 += translation_ws.y;
		
		var iMax = Math.round((ctx.canvas.width-x0)/dx);
		var iMin = Math.round(-x0/dx);
		ctx.beginPath();
		ctx.lineWidth = thick;
		ctx.strokeStyle = color;
		
		for (var i=iMin;i<=iMax;i++) {
			xx = dx*i; yy = scale*func(xx/scale);
			if (i==iMin) ctx.moveTo(x0+xx,y0-yy);
			else         ctx.lineTo(x0+xx,y0-yy);
		}
		ctx.stroke();
	}
	
	function showAxes() {
		var x0=axes.x0 + translation_ws.x, w=ctx.canvas.width;
		var y0=axes.y0 + translation_ws.y, h=ctx.canvas.height;
		ctx.beginPath();
		ctx.strokeStyle = "rgb(128,128,128)"; 
		ctx.moveTo(0,y0); ctx.lineTo(w,y0);  // X axis
		ctx.moveTo(x0,0); ctx.lineTo(x0,h);  // Y axis
		ctx.stroke();
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
			var dx = last_pos.x - event.pageX;
			var dy = last_pos.y - event.pageY;
			last_pos.x = event.pageX;
			last_pos.y = event.pageY;
			translation_ws.x -= dx;// / axes.scale;
			translation_ws.y -= dy;// / axes.scale;
			console.log(translation_ws);
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
	
	return {
		update: function(code){
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