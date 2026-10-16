package dev.zenith.client.module.setting;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import java.util.List;

public final class ModeSetting extends Setting<String> {
    private final List<String> modes;

    public ModeSetting(String id, String name, String def, String... modes) {
        super(id, name, def);
        this.modes = List.of(modes);
        if (!this.modes.contains(def)) throw new IllegalArgumentException("default mode not in list: " + def);
    }

    public List<String> modes() { return modes; }

    public void cycle() { set(modes.get((modes.indexOf(value) + 1) % modes.size())); }

    public boolean is(String mode) { return value.equals(mode); }

    @Override protected String normalize(String v) {
        for (String m : modes) if (m.equalsIgnoreCase(v)) return m;
        return value;
    }

    @Override public JsonElement toJson() { return new JsonPrimitive(value); }

    @Override public void fromJson(JsonElement json) {
        if (json != null && json.isJsonPrimitive()) value = normalize(json.getAsString());
    }

    @Override public boolean parse(String input) {
        for (String m : modes) if (m.equalsIgnoreCase(input)) { set(m); return true; }
        return false;
    }
}
