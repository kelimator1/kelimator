/* evidence/Y7-probe-uckeytranslate.c — task Y7 layout probe.
 *
 * Prints the current macOS keyboard-layout input source and the character
 * produced by each listed physical key (UCKeyTranslate, no modifiers, no dead
 * keys). Reproduces the owner measurement recorded in tasks/Y7-i-key-layout.md:
 * on this Mac (layout Turkish-QWERTY-PC) physical ANSI_I produces "ı" and
 * physical ANSI_Quote produces "i".
 *
 * Build/run (repo root):
 *   clang -framework Carbon -O0 -o "$TMPDIR/y7-uckeytranslate" \
 *     evidence/Y7-probe-uckeytranslate.c
 *   "$TMPDIR/y7-uckeytranslate"
 *   (log: evidence/logs/Y7-uckeytranslate.log)
 */
#include <Carbon/Carbon.h>
#include <stdio.h>

static void print_cfstring(const char *label, CFStringRef value) {
  if (value == NULL) {
    printf("%s: <null>\n", label);
    return;
  }
  char buffer[256] = {0};
  if (CFStringGetCString(value, buffer, sizeof(buffer), kCFStringEncodingUTF8)) {
    printf("%s: %s\n", label, buffer);
  } else {
    printf("%s: <unprintable>\n", label);
  }
}

static void print_key(const UCKeyboardLayout *layout, UInt32 keyCode, const char *name) {
  UInt32 deadKeyState = 0;
  UniChar chars[8] = {0};
  UniCharCount length = 0;
  OSStatus status = UCKeyTranslate(
      layout, (UInt16)keyCode, kUCKeyActionDown, /*modifiers=*/0,
      LMGetKbdType(), kUCKeyTranslateNoDeadKeysBit, &deadKeyState,
      sizeof(chars) / sizeof(chars[0]), &length, chars);
  if (status != noErr) {
    printf("%-12s (0x%02X): status %d\n", name, (unsigned)keyCode, (int)status);
    return;
  }
  printf("%-12s (0x%02X): \"", name, (unsigned)keyCode);
  for (UniCharCount i = 0; i < length; i += 1) {
    printf("%lc", (wint_t)chars[i]);
  }
  printf("\"  U+");
  for (UniCharCount i = 0; i < length; i += 1) {
    printf("%04X%s", (unsigned)chars[i], i + 1 < length ? " " : "");
  }
  if (length == 0) {
    printf("<none>");
  }
  printf("\n");
}

int main(void) {
  TISInputSourceRef source = TISCopyCurrentKeyboardLayoutInputSource();
  if (source == NULL) {
    printf("no current keyboard layout input source\n");
    return 1;
  }
  print_cfstring("input source id", TISGetInputSourceProperty(source, kTISPropertyInputSourceID));
  print_cfstring("localized name", TISGetInputSourceProperty(source, kTISPropertyLocalizedName));
  print_cfstring("type", TISGetInputSourceProperty(source, kTISPropertyInputSourceType));

  CFDataRef data = (CFDataRef)TISGetInputSourceProperty(
      source, kTISPropertyUnicodeKeyLayoutData);
  if (data == NULL) {
    printf("no Unicode key-layout data for the current source\n");
    CFRelease(source);
    return 1;
  }
  const UCKeyboardLayout *layout = (const UCKeyboardLayout *)CFDataGetBytePtr(data);

  printf("keyboard type (LMGetKbdType): %u\n", (unsigned)LMGetKbdType());
  printf("--- physical key -> produced character (UCKeyTranslate, no modifiers)\n");
  static const struct {
    UInt32 code;
    const char *name;
  } keys[] = {
      {kVK_ANSI_A, "ANSI_A"},           {kVK_ANSI_B, "ANSI_B"},
      {kVK_ANSI_C, "ANSI_C"},           {kVK_ANSI_D, "ANSI_D"},
      {kVK_ANSI_E, "ANSI_E"},           {kVK_ANSI_F, "ANSI_F"},
      {kVK_ANSI_G, "ANSI_G"},           {kVK_ANSI_H, "ANSI_H"},
      {kVK_ANSI_I, "ANSI_I"},           {kVK_ANSI_J, "ANSI_J"},
      {kVK_ANSI_K, "ANSI_K"},           {kVK_ANSI_L, "ANSI_L"},
      {kVK_ANSI_M, "ANSI_M"},           {kVK_ANSI_N, "ANSI_N"},
      {kVK_ANSI_O, "ANSI_O"},           {kVK_ANSI_P, "ANSI_P"},
      {kVK_ANSI_Q, "ANSI_Q"},           {kVK_ANSI_R, "ANSI_R"},
      {kVK_ANSI_S, "ANSI_S"},           {kVK_ANSI_T, "ANSI_T"},
      {kVK_ANSI_U, "ANSI_U"},           {kVK_ANSI_V, "ANSI_V"},
      {kVK_ANSI_W, "ANSI_W"},           {kVK_ANSI_X, "ANSI_X"},
      {kVK_ANSI_Y, "ANSI_Y"},           {kVK_ANSI_Z, "ANSI_Z"},
      {kVK_ANSI_Quote, "ANSI_Quote"},   {kVK_ANSI_Semicolon, "ANSI_Semicolon"},
      {kVK_ANSI_Comma, "ANSI_Comma"},   {kVK_ANSI_Period, "ANSI_Period"},
      {kVK_ANSI_Slash, "ANSI_Slash"},   {kVK_ANSI_Backslash, "ANSI_Backslash"},
      {kVK_ANSI_LeftBracket, "ANSI_LBracket"},
      {kVK_ANSI_RightBracket, "ANSI_RBracket"},
      {kVK_ANSI_Grave, "ANSI_Grave"},   {kVK_ANSI_Minus, "ANSI_Minus"},
      {kVK_ANSI_Equal, "ANSI_Equal"},   {kVK_ANSI_1, "ANSI_1"},
      {kVK_Space, "ANSI_Space"},
  };
  for (size_t i = 0; i < sizeof(keys) / sizeof(keys[0]); i += 1) {
    print_key(layout, keys[i].code, keys[i].name);
  }

  CFRelease(source);
  return 0;
}
