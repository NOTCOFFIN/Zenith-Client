package dev.zenith.client.command;

import static net.fabricmc.fabric.api.client.command.v2.ClientCommandManager.argument;
import static net.fabricmc.fabric.api.client.command.v2.ClientCommandManager.literal;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.suggestion.SuggestionProvider;
import dev.zenith.client.ZenithClient;
import dev.zenith.client.gui.HudEditorScreen;
import dev.zenith.client.gui.ZenithScreen;
import dev.zenith.client.module.Module;
import dev.zenith.client.module.setting.Setting;
import dev.zenith.client.notification.Notifications;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.minecraft.ChatFormatting;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.network.chat.Component;

/** Local client-side /zenith commands; never sent to the server. */
public final class ZenithCommands {
    private static final SuggestionProvider<FabricClientCommandSource> MODULES = (ctx, b) ->
            SharedSuggestionProvider.suggest(ZenithClient.get().modules().all().stream().map(Module::id), b);
    private static final SuggestionProvider<FabricClientCommandSource> SETTINGS = (ctx, b) -> {
        Module m = ZenithClient.get().modules().get(StringArgumentType.getString(ctx, "module"));
        return m == null ? b.buildFuture() : SharedSuggestionProvider.suggest(m.settings().stream().map(Setting::id), b);
    };

    private ZenithCommands() {}

    public static void register(CommandDispatcher<FabricClientCommandSource> d) {
        d.register(literal("zenith")
                .executes(ZenithCommands::help)
                .then(literal("help").executes(ZenithCommands::help))
                .then(literal("menu").executes(ctx -> { ZenithClient.get().openNextTick(new ZenithScreen(null)); return 1; }))
                .then(literal("hud").executes(ctx -> { ZenithClient.get().openNextTick(new HudEditorScreen(null)); return 1; }))
                .then(literal("version").executes(ctx -> ok(ctx, "Zenith Client " + ZenithClient.version())))
                .then(literal("list").executes(ZenithCommands::list))
                .then(literal("toggle").then(argument("module", StringArgumentType.word()).suggests(MODULES).executes(ctx -> setEnabled(ctx, null))))
                .then(literal("enable").then(argument("module", StringArgumentType.word()).suggests(MODULES).executes(ctx -> setEnabled(ctx, true))))
                .then(literal("disable").then(argument("module", StringArgumentType.word()).suggests(MODULES).executes(ctx -> setEnabled(ctx, false))))
                .then(literal("info").then(argument("module", StringArgumentType.word()).suggests(MODULES).executes(ZenithCommands::info)))
                .then(literal("set").then(argument("module", StringArgumentType.word()).suggests(MODULES)
                        .then(argument("setting", StringArgumentType.word()).suggests(SETTINGS)
                                .then(argument("value", StringArgumentType.greedyString()).executes(ZenithCommands::set)))))
                .then(literal("config")
                        .then(literal("save").executes(ctx -> ZenithClient.get().config().save() ? ok(ctx, "Config saved") : err(ctx, "Could not save config, see log")))
                        .then(literal("reload").executes(ctx -> ZenithClient.get().config().load() ? ok(ctx, "Config reloaded") : err(ctx, "No readable config file found")))
                        .then(literal("reset").executes(ctx -> { ZenithClient.get().config().resetAll(); return ok(ctx, "All modules reset to defaults"); }))
                        .then(literal("path").executes(ctx -> ok(ctx, ZenithClient.get().config().file().toString()))))
                .then(literal("notify").then(argument("message", StringArgumentType.greedyString()).executes(ctx -> {
                    Notifications.info("Zenith", StringArgumentType.getString(ctx, "message"));
                    return 1;
                }))));
    }

    private static int help(CommandContext<FabricClientCommandSource> ctx) {
        String[] lines = {
            "/zenith menu - open the Zenith menu (Right Shift)",
            "/zenith hud - open the HUD editor",
            "/zenith list - list modules",
            "/zenith toggle|enable|disable <module>",
            "/zenith info <module> - show settings",
            "/zenith set <module> <setting> <value>",
            "/zenith config save|reload|reset|path",
            "/zenith notify <message> - show a notification",
            "/zenith version"
        };
        ctx.getSource().sendFeedback(Component.literal("Zenith Client commands").withStyle(ChatFormatting.AQUA, ChatFormatting.BOLD));
        for (String l : lines) ctx.getSource().sendFeedback(Component.literal(" " + l).withStyle(ChatFormatting.GRAY));
        return 1;
    }

    private static int list(CommandContext<FabricClientCommandSource> ctx) {
        for (Module m : ZenithClient.get().modules().all()) {
            ctx.getSource().sendFeedback(Component.literal(m.enabled() ? "\u25CF " : "\u25CB ").withStyle(m.enabled() ? ChatFormatting.GREEN : ChatFormatting.DARK_GRAY)
                    .append(Component.literal(m.id()).withStyle(ChatFormatting.WHITE))
                    .append(Component.literal(" - " + m.name() + " [" + m.category().displayName + "]").withStyle(ChatFormatting.GRAY)));
        }
        return 1;
    }

    private static Module module(CommandContext<FabricClientCommandSource> ctx) {
        String id = StringArgumentType.getString(ctx, "module");
        Module m = ZenithClient.get().modules().get(id);
        if (m == null) err(ctx, "Unknown module '" + id + "'. Use /zenith list");
        return m;
    }

    private static int setEnabled(CommandContext<FabricClientCommandSource> ctx, Boolean value) {
        Module m = module(ctx);
        if (m == null) return 0;
        if (!m.toggleable()) return err(ctx, m.name() + " is always enabled");
        m.setEnabled(value == null ? !m.enabled() : value);
        return ok(ctx, m.name() + " " + (m.enabled() ? "enabled" : "disabled"));
    }

    private static int info(CommandContext<FabricClientCommandSource> ctx) {
        Module m = module(ctx);
        if (m == null) return 0;
        ctx.getSource().sendFeedback(Component.literal(m.name() + " (" + (m.enabled() ? "enabled" : "disabled") + ")").withStyle(ChatFormatting.AQUA));
        ctx.getSource().sendFeedback(Component.literal(m.description()).withStyle(ChatFormatting.GRAY));
        for (Setting<?> s : m.settings()) ctx.getSource().sendFeedback(Component.literal(" " + s.id() + " = " + s.display()).withStyle(ChatFormatting.WHITE));
        return 1;
    }

    private static int set(CommandContext<FabricClientCommandSource> ctx) {
        Module m = module(ctx);
        if (m == null) return 0;
        String sid = StringArgumentType.getString(ctx, "setting");
        Setting<?> s = m.setting(sid);
        if (s == null) return err(ctx, "Unknown setting '" + sid + "' for " + m.id());
        String value = StringArgumentType.getString(ctx, "value");
        if (!s.parse(value.trim())) return err(ctx, "Invalid value '" + value + "' for " + s.name());
        return ok(ctx, m.name() + " \u2192 " + s.name() + " = " + s.display());
    }

    private static int ok(CommandContext<FabricClientCommandSource> ctx, String msg) {
        ctx.getSource().sendFeedback(Component.literal("[Zenith] ").withStyle(ChatFormatting.AQUA).append(Component.literal(msg).withStyle(ChatFormatting.WHITE)));
        return 1;
    }

    private static int err(CommandContext<FabricClientCommandSource> ctx, String msg) {
        ctx.getSource().sendError(Component.literal("[Zenith] " + msg));
        return 0;
    }
}
