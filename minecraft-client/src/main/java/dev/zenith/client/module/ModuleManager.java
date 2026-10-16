package dev.zenith.client.module;

import dev.zenith.client.hud.HudModule;
import dev.zenith.client.module.impl.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.minecraft.client.Minecraft;

public final class ModuleManager {
    private final Map<String, Module> modules = new LinkedHashMap<>();
    private Runnable changeListener = () -> {};

    public static ModuleManager createDefault() {
        ModuleManager m = new ModuleManager();
        m.register(new FpsModule());
        m.register(new CoordinatesModule());
        m.register(new KeystrokesModule());
        m.register(new CpsModule());
        m.register(new ArmorStatusModule());
        m.register(new PingModule());
        m.register(new ClockModule());
        m.register(new MemoryModule());
        m.register(new ServerAddressModule());
        m.register(new ToggleSprintModule());
        m.register(new ZoomModule());
        m.register(new DynamicFpsModule());
        m.register(new ClientSettingsModule());
        return m;
    }

    public void register(Module module) {
        if (modules.putIfAbsent(module.id(), module) != null) throw new IllegalStateException("duplicate module id " + module.id());
        module.setChangeListener(() -> changeListener.run());
    }

    public void setChangeListener(Runnable r) { this.changeListener = r; }

    public List<Module> all() { return Collections.unmodifiableList(new ArrayList<>(modules.values())); }

    public Module get(String id) {
        if (id == null) return null;
        Module m = modules.get(id.toLowerCase());
        if (m != null) return m;
        for (Module mod : modules.values()) if (mod.name().equalsIgnoreCase(id) || mod.name().replace(" ", "").equalsIgnoreCase(id)) return mod;
        return null;
    }

    @SuppressWarnings("unchecked")
    public <T extends Module> T get(Class<T> type) {
        for (Module m : modules.values()) if (type.isInstance(m)) return (T) m;
        throw new IllegalArgumentException("module not registered: " + type.getSimpleName());
    }

    public List<Module> byCategory(Category c) {
        return modules.values().stream().filter(m -> m.category() == c).toList();
    }

    public List<HudModule> hud() {
        return modules.values().stream().filter(m -> m instanceof HudModule).map(m -> (HudModule) m).toList();
    }

    public List<Module> search(Category category, String query) {
        return modules.values().stream()
                .filter(m -> (category == null || m.category() == category) && m.matches(query))
                .toList();
    }

    public void tick(Minecraft mc) {
        for (Module m : modules.values()) if (m.enabled()) m.tick(mc);
    }
}
