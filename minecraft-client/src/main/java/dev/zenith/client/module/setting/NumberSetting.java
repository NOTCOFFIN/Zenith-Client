package dev.zenith.client.module.setting;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

public final class NumberSetting extends Setting<Double> {
    private final double min;
    private final double max;
    private final double step;

    public NumberSetting(String id, String name, double def, double min, double max, double step) {
        super(id, name, def);
        this.min = min;
        this.max = max;
        this.step = step;
    }

    public double min() { return min; }
    public double max() { return max; }
    public double step() { return step; }
    public int intValue() { return (int) Math.round(value); }

    @Override protected Double normalize(Double v) {
        if (v == null || v.isNaN()) return value;
        double clamped = Math.max(min, Math.min(max, v));
        if (step > 0) clamped = min + Math.round((clamped - min) / step) * step;
        return Math.max(min, Math.min(max, Math.round(clamped * 1000.0) / 1000.0));
    }

    @Override public JsonElement toJson() { return new JsonPrimitive(value); }

    @Override public void fromJson(JsonElement json) {
        if (json != null && json.isJsonPrimitive() && json.getAsJsonPrimitive().isNumber()) value = normalize(json.getAsDouble());
    }

    @Override public boolean parse(String input) {
        try {
            set(Double.parseDouble(input));
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    @Override public String display() {
        return step >= 1 ? String.valueOf(intValue()) : String.format(java.util.Locale.ROOT, "%.2f", value);
    }
}
