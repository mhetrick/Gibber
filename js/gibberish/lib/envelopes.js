define([], function() {
    return {
		init: function(gibberish) {						
			gibberish.generators.Env = gibberish.createGenerator(["attack",  "decay"], "{0}({1}, {2})" ),
			gibberish.make["Env"] = this.makeEnv;
			gibberish.Env = this.Env;
			
			gibberish.generators.ADSR = gibberish.createGenerator(["attack",  "decay", "sustain", "release", "attackLevel", "sustainLevel"], "{0}({1},{2},{3},{4},{5},{6})" ),
			gibberish.make["ADSR"] = this.makeADSR;
			gibberish.ADSR = this.ADSR;
			
			gibberish.generators.Step = gibberish.createGenerator(["time"], "{0}({1})" ),
			gibberish.make["Step"] = this.makeStep;
			gibberish.Step = this.Step;
			
			gibberish.generators.Line = gibberish.createGenerator(["time", "loops"], "{0}({1}, {2})" ),
			gibberish.make["Line"] = this.makeLine;
			gibberish.Line = this.Line;
			
			// simple exponential decay
			gibberish.EG = Gen({
				name:"EnvelopeGenerator",
				props: { decay:.5, length:11050 },
				
				upvalues: { pow:Math.pow, value:0, phase:0 },
				
				callback: function( decay, length ) {
					value = pow( decay, phase );
					phase += 1 / length;

					return value;
				},
			});
		  
	      gibberish.Follow = gibberish.Follow2 = Gen({
	        name: "Follow",
	        props: { input:0, bufferSize:4410, mult:1 },
	        upvalues: { abs:Math.abs, history:null, sum:0, index:0, value:0 },
			
	        init: function() {
            //this.getValue = function() { return value; }
	         	this.function.setHistory([0]);
	        },
			
	        callback: function(input, bufferSize, mult) {
	        	sum += abs(input[0]);
	        	sum -= history[index];
	        	history[index] = abs(input[0]);
	        	index = (index + 1) % bufferSize;
				
				    // zero history array iteratively instead of on initialization which can cause hiccups
    				history[index] = history[index] ? history[index] : 0;
	        	value = (sum / bufferSize) * mult;
    				return [0, 0];
	        },
	      });
		  
	  
	      gibberish.Pump = Gen({
	        name: "Pump",
	        props: {sidechain:null, bufferSize:4410, mult:1},
	        upvalues: {abs:Math.abs, history:null, sum:0, index:0},
		
	        init: function() {
	         this.function.setHistory( new Float32Array(this.bufferSize) );
	        }, 
		
	        callback: function(sidechain, bufferSize, mult) {
	          sum += abs(sidechain[0]);
	          sum -= history[index];
	          history[index] = abs(sidechain[0]);
	          index = (index + 1) % bufferSize;
	          val = 1 - (sum / bufferSize) * mult;
	          val = val > 0 ? val : 0;
	          return val;
	        },
	      });
		},
		
		Env : function(attack, decay) {
			var that = { 
				type:		"Env",
				category:	"Gen",
				attack:		attack || 10000,
				decay:		decay || 10000,

				run: function() {
					//that.function.setPhase(0);
					this.function.setState(0);
					this.function.setPhase(0);
					return this;			
				},
			};
			Gibberish.extend(that, new Gibberish.ugen());
			
			that.symbol = Gibberish.generateSymbol(that.type);
			Gibberish.masterInit.push(that.symbol + " = Gibberish.make[\"Env\"]();");
			window[that.symbol] = Gibberish.make["Env"]();
			that.function = window[that.symbol];
			that.function.setState(2);
			
			Gibberish.defineProperties( that, ["attack", "decay"] );
			
			return that;
		},
		
		makeEnv : function() {
			var phase = 0;
			var state = 0;
			var output = function(attack,decay) {
				attack = attack < 0 ? _4 : attack;
				decay  = decay  < 0 ? _4 : decay;				
				if(state === 0){
					var incr = 1 / attack;
					phase += incr;
					if(phase >=1) {
						state++;
					}
				}else if(state === 1){
					var incr = 1 / decay;
					phase -= incr;
					if(phase <= 0) {
						phase = 0;
						state++;;
					}			
				}
				return phase;
				
				/*
				if(state < 2) {
					attack = attack < 0 ? _4 : attack;
					decay  = decay  < 0 ? _4 : decay;
					
					var incr = state ? 1 / decay : 1 / attack
					phase += state ? incr * -1 : incr;
				
					state += phase >= 1 ? 1 : 0;
					state += phase <= 0 ? 1 : 0;
					phase =  phase <= 0 ? 0 : phase;
				}
				
				return phase;
				*/
			};
			output.setPhase = function(newPhase) { phase = newPhase; };
			output.setState = function(newState) { state = newState; };
			output.getState = function() { return state; };						
			output.start = function() { phase = 0; state = 0; }
			
			return output;
		},
		
		ADSR : function(attack, decay, sustain, release, attackLevel, sustainLevel) {
			var that = { 
				type:		"ADSR",
				category:	"Gen",	
				attack:		isNaN(attack) ? 10000 : attack,
				decay:		isNaN(decay) ? 0 : decay,
				release:	isNaN(release) ? 10000 : release,
				sustain: 	typeof sustain === "undefined" ? null : sustain,
				attackLevel:  attackLevel || 1,
				sustainLevel: sustainLevel || 1,

				run: function() {
					that.function.setPhase(0);
					that.function.setState(0);
				},
			};
			Gibberish.extend(that, new Gibberish.ugen());
			
			that.symbol = Gibberish.generateSymbol(that.type);
			Gibberish.masterInit.push(that.symbol + " = Gibberish.make[\"ADSR\"]();");
			window[that.symbol] = Gibberish.make["ADSR"]();
			that.function = window[that.symbol];
			
			Gibberish.defineProperties( that, ["attack", "decay", "sustain", "release", "attackLevel", "sustainLevel"] );
	
			return that;
		},
		
		makeADSR : function() {
			var phase = 0;
			var state = 0;
			var output = function(attack,decay,sustain,release,attackLevel,sustainLevel) {
				var val = 0;
				if(state === 0){
					val = phase / attack * attackLevel;
					if(++phase / attack === 1) {
						state++;
						phase = decay;
					}
				}else if(state === 1) {
					val = phase / decay * (attackLevel - sustainLevel) + sustainLevel;
					if(--phase <= 0) {
						if(sustain !== null){
							state += 1;
							phase = sustain;
						}else{
							state += 2;
							phase = release;
						}
					}
				}else if(state === 2) {
					val = sustainLevel;
					if(phase-- === 0) {
						state++;
						phase = release;
					}
				}else if(state === 3) {
					val = (phase-- / release) * sustainLevel;
					if(phase <= 0) state++;
				}
				return val;
			};
			output.setPhase = function(newPhase) { phase = newPhase; };
			output.setState = function(newState) { state = newState; phase = 0; };
			output.getState = function() { return state; };	
			
			return output;
		},
		
		Step : function(steps, time) {
			var that = { 
				type:		"Step",
				category:	"Gen",
				steps:		steps || [1],
				time:		time || 44100,

				run: function() {
					//that.function.setPhase(0);
					that.function.setState(0);
					that.function.setPhase(0);					
				},
			};
			Gibberish.extend(that, new Gibberish.ugen());
			
			that.symbol = Gibberish.generateSymbol(that.type);
			Gibberish.masterInit.push(that.symbol + " = Gibberish.make[\"Step\"]();");
			window[that.symbol] = Gibberish.make["Step"](that.steps);
			that.function = window[that.symbol];
			
			Gibberish.defineProperties( that, ["attack", "decay"] );
	
			return that;
		},
		
		makeStep : function(steps) {
			var phase = 0;
			var state = 0;
			var output = function(time) {
				//phase = phase >= time ? 0 : phase + 1;
				//state = 
				if(phase++ >= time) {
					state++;
					if(state >= steps.length) state = 0;
					phase = 0;
				}
				return steps[state];
			};
			output.setPhase = function(newPhase) { phase = newPhase; };
			output.setState = function(newState) { state = newState; };
			output.getState = function() { return state; };						
			output.start = function() { phase = 0; state = 0; }
			
			return output;
		},	
		
		Line : function(start, end, time, loops) {
			var that = { 
				type:		"Line",
				category:	"Gen",
				start:		start || 0,
				end:		isNaN(end) ? 1 : end,
				time:		time || 44100,
				loops:		loops || false,
			};
			Gibberish.extend(that, new Gibberish.ugen());
			
			that.symbol = Gibberish.generateSymbol(that.type);
			Gibberish.masterInit.push(that.symbol + " = Gibberish.make[\"Line\"]();");
			window[that.symbol] = Gibberish.make["Line"](that.start, that.end, that.time);
			that.function = window[that.symbol];
			
			Gibberish.defineProperties( that, ["loops", "time"] );
	
			return that;
		},
		
		makeLine : function(start, end, time) {
			var phase = 0;
			var incr = (end - start) / time;
			
			var output = function(time, loops) {
				var out = phase < time ? start + ( phase++ * incr) : end;
				
				phase = (out >= end && loops) ? 0 : phase;
				
				return out;
			};
			
			return output;
		},
    }
});
