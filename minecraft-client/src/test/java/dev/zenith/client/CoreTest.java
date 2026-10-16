package dev.zenith.client;

import static org.junit.jupiter.api.Assertions.*;

import dev.zenith.client.config.ConfigStore;
import dev.zenith.client.hud.HudModule;
import dev.zenith.client.module.Category;
import dev.zenith.client.module.ClickTracker;
import dev.zenith.client.module.Module;
import dev.zenith.client.module.ModuleManager;
import dev.zenith.client.module.impl.ClientSettingsModule;
import dev.zenith.client.module.impl.ZoomModule;
import dev.zenith.client.module.setting.BooleanSetting;
import dev.zenith.client.module.setting.ModeSetting;
import dev.zenith.client.module.setting.NumberSetting;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CoreTest {
    @Test
    void numberSettingClampsAndSnaps() {
        NumberSetting n = new NumberSetting("f", "F", 4, 1.5, 10, 0.5);
        n.set(100.0);
        assertEquals(10.0, n.get());
        n.set(3.3);
        assertEquals(3.5, n.get());
        assertFalse(n.parse("abc"));
        assertTrue(n.parse("2"));
        assertEquals(2.0, n.get());
    }

    @Test
    void modeAndBooleanParsing() {
        ModeSetting m = new ModeSetting("m", "M", "24h", "24h", "12h");
        assertTrue(m.parse("12H"));
        assertEquals("12h", m.get());
        m.cycle();
        assertEquals("24h", m.get());
        assertFalse(m.parse("bogus"));
        BooleanSetting b = new BooleanSetting("b", "B", false);
        assertTrue(b.parse("on"));
        assertTrue(b.get());
        assertFalse(b.parse("maybe"));
    }

    @Test
    void registryLookupAndSearch() {
        ModuleManager mm = ModuleManager.createDefault();
        assertNotNull(mm.get("fps"));
        assertSame(mm.get("fps"), mm.get("FPS Display"));
        assertSame(mm.get("togglesprint"), mm.get("ToggleSprint"));
        assertTrue(mm.search(Category.HUD, "").stream().allMatch(m -> m instanceof HudModule));
        assertTrue(mm.search(null, "sprint").stream().anyMatch(m -> m.id().equals("togglesprint")));
        assertThrows(IllegalStateException.class, () -> mm.register(new ZoomModule()));
    }

    @Test
    void clientSettingsCannotBeDisabled() {
        ModuleManager mm = ModuleManager.createDefault();
        Module client = mm.get(ClientSettingsModule.class);
        client.setEnabled(false);
        assertTrue(client.enabled());
        client.restoreEnabled(false);
        assertTrue(client.enabled());
    }

    @Test
    void changesNotifyListener() {
        ModuleManager mm = ModuleManager.createDefault();
        AtomicInteger changes = new AtomicInteger();
        mm.setChangeListener(changes::incrementAndGet);
        mm.get("clock").toggle();
        ((ModeSetting) mm.get("clock").setting("format")).cycle();
        assertEquals(2, changes.get());
    }

    @Test
    void configRoundTripAndBackupRecovery(@TempDir Path dir) throws Exception {
        ModuleManager a = ModuleManager.createDefault();
        a.get("keystrokes").setEnabled(true);
        ((NumberSetting) a.get("zoom").setting("factor")).set(7.0);
        ((HudModule) a.get("fps")).position().set(0.4, 0.6);
        ConfigStore store = new ConfigStore(dir, a);
        assertTrue(store.save());
        assertTrue(store.save());
        assertTrue(Files.exists(dir.resolve("config.json.bak")));

        ModuleManager b = ModuleManager.createDefault();
        assertTrue(new ConfigStore(dir, b).load());
        assertTrue(b.get("keystrokes").enabled());
        assertEquals(7.0, ((NumberSetting) b.get("zoom").setting("factor")).get());
        assertEquals(0.4, ((HudModule) b.get("fps")).position().x(), 1e-9);

        Files.writeString(dir.resolve("config.json"), "{ corrupt");
        ModuleManager c = ModuleManager.createDefault();
        assertTrue(new ConfigStore(dir, c).load());
        assertTrue(c.get("keystrokes").enabled());
    }

    @Test
    void malformedConfigValuesAreIgnored(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("config.json"), "{\"modules\":{\"zoom\":{\"enabled\":true,\"settings\":{\"factor\":\"huge\"}},\"fps\":{\"hud\":{\"x\":5,\"scale\":99}}}}");
        ModuleManager mm = ModuleManager.createDefault();
        assertTrue(new ConfigStore(dir, mm).load());
        assertEquals(4.0, ((NumberSetting) mm.get("zoom").setting("factor")).get());
        assertEquals(1.0, ((HudModule) mm.get("fps")).position().x());
        assertEquals(3.0, ((HudModule) mm.get("fps")).position().scale());
    }

    @Test
    void clickTrackerSlidingWindow() {
        ClickTracker.reset();
        ClickTracker.click(0, 1000);
        ClickTracker.click(0, 1500);
        ClickTracker.click(1, 1600);
        assertEquals(2, ClickTracker.cps(0, 1900));
        assertEquals(1, ClickTracker.cps(0, 2200));
        assertEquals(0, ClickTracker.cps(1, 2700));
    }
}
