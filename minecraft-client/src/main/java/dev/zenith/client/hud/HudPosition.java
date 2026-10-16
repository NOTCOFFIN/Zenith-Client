package dev.zenith.client.hud;

import com.google.gson.JsonObject;

/** Position stored as fractions of the scaled screen so layouts survive resolution changes. */
public final class HudPosition {
    private final double defaultX;
    private final double defaultY;
    private final double defaultScale;
    private double x;
    private double y;
    private double scale;

    public HudPosition(double x, double y) {
        this(x, y, 1.0);
    }

    public HudPosition(double x, double y, double scale) {
        this.defaultX = x;
        this.defaultY = y;
        this.defaultScale = scale;
        reset();
    }

    public double x() { return x; }
    public double y() { return y; }
    public double scale() { return scale; }

    public void set(double nx, double ny) {
        x = clamp01(nx);
        y = clamp01(ny);
    }

    public void setScale(double s) { scale = Math.max(0.5, Math.min(3.0, Math.round(s * 10.0) / 10.0)); }

    public void reset() {
        x = defaultX;
        y = defaultY;
        scale = defaultScale;
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("x", x);
        o.addProperty("y", y);
        o.addProperty("scale", scale);
        return o;
    }

    public void fromJson(JsonObject o) {
        try {
            if (o.has("x")) x = clamp01(o.get("x").getAsDouble());
            if (o.has("y")) y = clamp01(o.get("y").getAsDouble());
            if (o.has("scale")) setScale(o.get("scale").getAsDouble());
        } catch (RuntimeException ignored) {
            // keep the current values when the file holds malformed numbers
        }
    }

    private static double clamp01(double v) {
        return Double.isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
    }
}
