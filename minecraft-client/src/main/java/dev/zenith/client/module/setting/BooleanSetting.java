package dev.zenith.client.module.setting;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

public final class BooleanSetting extends Setting<Boolean> {
    public BooleanSetting(String id, String name, boolean def) { super(id, name, def); }

    public void toggle() { set(!value); }

    @Override public JsonElement toJson() { return new JsonPrimitive(value); }

    @Override public void fromJson(JsonElement json) {
        if (json != null && json.isJsonPrimitive() && json.getAsJsonPrimitive().isBoolean()) value = json.getAsBoolean();
    }

    @Override public boolean parse(String input) {
        switch (input.toLowerCase()) {
            case "true", "on", "yes", "1" -> set(true);
            case "false", "off", "no", "0" -> set(false);
            default -> { return false; }
        }
        return true;
    }

    @Override public String display() { return value ? "On" : "Off"; }
}
