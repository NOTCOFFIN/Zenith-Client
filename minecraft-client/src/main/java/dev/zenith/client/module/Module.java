package dev.zenith.client.module;

import dev.zenith.client.module.setting.Setting;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import net.minecraft.client.Minecraft;

public abstract class Module {
    private final String id;
    private final String name;
    private final String description;
    private final Category category;
    private final boolean defaultEnabled;
    private boolean enabled;
    private final List<Setting<?>> settings = new ArrayList<>();
    private Runnable changeListener = () -> {};

    protected Module(String id, String name, String description, Category category, boolean defaultEnabled) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.category = category;
        this.defaultEnabled = defaultEnabled;
        this.enabled = defaultEnabled;
    }

    protected <S extends Setting<?>> S add(S setting) {
        setting.addListener(() -> changeListener.run());
        settings.add(setting);
        return setting;
    }

    public String id() { return id; }
    public String name() { return name; }
    public String description() { return description; }
    public Category category() { return category; }
    public boolean enabled() { return enabled; }
    public boolean defaultEnabled() { return defaultEnabled; }
    public List<Setting<?>> settings() { return Collections.unmodifiableList(settings); }

    public Setting<?> setting(String id) {
        for (Setting<?> s : settings) if (s.id().equalsIgnoreCase(id)) return s;
        return null;
    }

    /** Modules that hold client-wide settings return false and cannot be switched off. */
    public boolean toggleable() { return true; }

    public void setEnabled(boolean value) {
        if (value == enabled || (!value && !toggleable())) return;
        enabled = value;
        if (value) onEnable(); else onDisable();
        changeListener.run();
    }

    /** Loads persisted state without firing change callbacks. */
    public void restoreEnabled(boolean value) {
        enabled = value || !toggleable();
    }

    public void toggle() { setEnabled(!enabled); }

    void setChangeListener(Runnable r) { this.changeListener = r; }

    protected void onEnable() {}
    protected void onDisable() {}
    public void tick(Minecraft mc) {}

    public boolean matches(String query) {
        if (query == null || query.isBlank()) return true;
        String q = query.toLowerCase();
        return name.toLowerCase().contains(q) || id.contains(q) || description.toLowerCase().contains(q)
                || category.displayName.toLowerCase().contains(q);
    }
}
