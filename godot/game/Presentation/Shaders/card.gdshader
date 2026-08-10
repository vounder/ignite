shader_type canvas_item;

uniform float hover_strength : hint_range(0.0, 1.0) = 0.0;
uniform vec2 pointer = vec2(0.5, 0.5);
uniform vec4 accent : source_color = vec4(1.0, 0.3, 0.1, 1.0);

void vertex() {
	float perspective = (pointer.x - 0.5) * hover_strength;
	VERTEX.x += (UV.y - 0.5) * perspective * 14.0;
	VERTEX.y += (UV.x - 0.5) * (pointer.y - 0.5) * hover_strength * 8.0;
}

void fragment() {
	vec4 base = texture(TEXTURE, UV) * COLOR;
	float sweep = smoothstep(0.13, 0.0, abs((UV.x + UV.y * 0.35) - (0.25 + hover_strength * 0.9)));
	float rim = smoothstep(0.16, 0.0, min(min(UV.x, 1.0 - UV.x), min(UV.y, 1.0 - UV.y)));
	base.rgb += accent.rgb * (sweep * 0.12 + rim * hover_strength * 0.08);
	COLOR = base;
}
