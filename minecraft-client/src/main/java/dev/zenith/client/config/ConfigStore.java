package dev.zenith.client.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.zenith.client.ZenithClient;
import dev.zenith.client.hud.HudModule;
import dev.zenith.client.module.Module;
import dev.zenith.client.module.ModuleManager;
import dev.zenith.client.module.setting.Setting;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/** Persists module state to config/zenith/config.json with atomic writes and a .bak fallback. */
public final class ConfigStore {
    public static final int SCHEMA_VERSION = 1;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final int SAVE_DELAY_TICKS = 40;

    private final Path dir;
    private final Path file;
    private final Path backup;
    private final ModuleManager modules;
    private int dirtyTicks = -1;

    public ConfigStore(Path dir, ModuleManager modules) {
        this.dir = dir;
        this.file = dir.resolve("config.json");
        this.backup = dir.resolve("config.json.bak");
        this.modules = modules;
    }

    public Path file() { return file; }

    public void markDirty() { dirtyTicks = SAVE_DELAY_TICKS; }

    public void tick() {
        if (dirtyTicks > 0 && --dirtyTicks == 0) {
            dirtyTicks = -1;
            save();
        }
    }

    /** Loads config; falls back to the backup if the main file is missing or corrupt. Returns true on success. */
    public boolean load() {
        for (Path candidate : new Path[] {file, backup}) {
            if (!Files.isRegularFile(candidate)) continue;
            try {
                JsonObject root = JsonParser.parseString(Files.readString(candidate, StandardCharsets.UTF_8)).getAsJsonObject();
                apply(root);
                if (candidate == backup) ZenithClient.LOG.warn("Zenith config was unreadable; restored from backup");
                return true;
            } catch (Exception e) {
                ZenithClient.LOG.warn("Failed to read Zenith config {}: {}", candidate, e.toString());
            }
        }
        return false;
    }

    public void apply(JsonObject root) {
        JsonObject mods = root.has("modules") && root.get("modules").isJsonObject() ? root.getAsJsonObject("modules") : new JsonObject();
        for (Module m : modules.all()) {
            if (!mods.has(m.id()) || !mods.get(m.id()).isJsonObject()) continue;
            JsonObject o = mods.getAsJsonObject(m.id());
            if (o.has("enabled") && o.get("enabled").isJsonPrimitive()) m.restoreEnabled(o.get("enabled").getAsBoolean());
            JsonObject settings = o.has("settings") && o.get("settings").isJsonObject() ? o.getAsJsonObject("settings") : new JsonObject();
            for (Setting<?> s : m.settings()) s.fromJson(settings.get(s.id()));
            if (m instanceof HudModule h && o.has("hud") && o.get("hud").isJsonObject()) h.position().fromJson(o.getAsJsonObject("hud"));
        }
    }

    public JsonObject serialize() {
        JsonObject root = new JsonObject();
        root.addProperty("schemaVersion", SCHEMA_VERSION);
        JsonObject mods = new JsonObject();
        for (Module m : modules.all()) {
            JsonObject o = new JsonObject();
            o.addProperty("enabled", m.enabled());
            JsonObject settings = new JsonObject();
            for (Setting<?> s : m.settings()) {
                JsonElement v = s.toJson();
                settings.add(s.id(), v);
            }
            o.add("settings", settings);
            if (m instanceof HudModule h) o.add("hud", h.position().toJson());
            mods.add(m.id(), o);
        }
        root.add("modules", mods);
        return root;
    }

    public synchronized boolean save() {
        dirtyTicks = -1;
        try {
            Files.createDirectories(dir);
            Path tmp = dir.resolve("config.json.tmp");
            Files.writeString(tmp, GSON.toJson(serialize()), StandardCharsets.UTF_8);
            if (Files.isRegularFile(file)) Files.copy(file, backup, StandardCopyOption.REPLACE_EXISTING);
            try {
                Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
            }
            return true;
        } catch (IOException e) {
            ZenithClient.LOG.error("Failed to save Zenith config", e);
            return false;
        }
    }

    public void resetAll() {
        for (Module m : modules.all()) {
            m.setEnabled(m.defaultEnabled());
            for (Setting<?> s : m.settings()) s.reset();
            if (m instanceof HudModule h) h.position().reset();
        }
        save();
    }
}
