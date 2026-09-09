#import <UIKit/UIKit.h>
#import <Contacts/Contacts.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import <dlfcn.h>

static NSMutableString *L;
static void P(NSString *f, ...) { va_list a; va_start(a,f); [L appendString:[[NSString alloc] initWithFormat:f arguments:a]]; [L appendString:@"\n"]; va_end(a); }

static NSString *colorDesc(UIColor *c) {
  if (!c) return @"nil";
  CGFloat r,g,b,al; if ([c getRed:&r green:&g blue:&b alpha:&al]) return [NSString stringWithFormat:@"rgba(%.4f,%.4f,%.4f,%.4f)",r*255,g*255,b*255,al];
  return c.description;
}

static void tree(UIView *v, int depth, UIView *root) {
  NSMutableString *pad = [NSMutableString string];
  for (int i=0;i<depth;i++) [pad appendString:@"  "];
  CGRect f = [v convertRect:v.bounds toView:root];
  NSMutableString *extra = [NSMutableString string];
  if ([v isKindOfClass:UILabel.class]) { UILabel *l=(UILabel*)v; [extra appendFormat:@" text='%@' font=%@ %.4f color=%@", l.text?:@"", l.font.fontName, l.font.pointSize, colorDesc(l.textColor)]; }
  if ([v isKindOfClass:UIImageView.class]) { UIImageView *iv=(UIImageView*)v; [extra appendFormat:@" img=%@ tint=%@", iv.image ? [NSString stringWithFormat:@"%.3fx%.3f", iv.image.size.width, iv.image.size.height] : @"nil", colorDesc(iv.tintColor)]; }
  if ([v isKindOfClass:UITextField.class]) { UITextField *t=(UITextField*)v; [extra appendFormat:@" tf='%@' ph='%@' font=%@ %.4f", t.text?:@"", t.placeholder?:@"", t.font.fontName, t.font.pointSize]; }
  if (v.backgroundColor) [extra appendFormat:@" bg=%@", colorDesc(v.backgroundColor)];
  if (v.layer.cornerRadius) [extra appendFormat:@" r=%.4f curve=%@", v.layer.cornerRadius, v.layer.cornerCurve];
  if (v.layer.mask) [extra appendString:@" MASK"];
  if (v.hidden) [extra appendString:@" HIDDEN"];
  if (v.alpha != 1) [extra appendFormat:@" alpha=%.3f", v.alpha];
  P(@"%@%s frame{%.4f,%.4f,%.4f,%.4f} inRoot{%.4f,%.4f,%.4f,%.4f}%@", pad, object_getClassName(v),
    v.frame.origin.x, v.frame.origin.y, v.frame.size.width, v.frame.size.height,
    f.origin.x, f.origin.y, f.size.width, f.size.height, extra);
  for (UIView *s in v.subviews) tree(s, depth+1, root);
}

static NSArray *contacts(int n){
  static const char *kNames[7][2] = {{"Jamie","Aldrich"},{"Kai","Bell"},{"Rosa","Chen"},{"Dana","Wu"},{"Noor","Haddad"},{"Robin","Diaz"},{"Sam","Rivera"}};
  NSMutableArray *a=[NSMutableArray array];
  for(int i=0;i<n;i++){CNMutableContact*c=[CNMutableContact new];c.givenName=[NSString stringWithUTF8String:kNames[i][0]];c.familyName=[NSString stringWithUTF8String:kNames[i][1]];[a addObject:c];}
  return a;
}
static UIView *ckAvatar(int n, double size, CGPoint at){
  Class AV=objc_getClass("CKAvatarView");
  UIView *v=((id(*)(id,SEL,CGRect))objc_msgSend)([AV alloc],sel_getUid("initWithFrame:"),CGRectMake(at.x,at.y,size,size));
  ((void(*)(id,SEL,BOOL))objc_msgSend)(v,sel_getUid("setAsynchronousRendering:"),NO);
  ((void(*)(id,SEL,id))objc_msgSend)(v,sel_getUid("setContacts:"),contacts(n));
  return v;
}
static double clsD(const char *cls, const char *sel) {
  Class c = objc_getClass(cls); if (!c) return -1;
  SEL s = sel_getUid(sel); if (![c respondsToSelector:s]) return -2;
  return ((double(*)(id,SEL))objc_msgSend)(c, s);
}

@interface AD : UIResponder <UIApplicationDelegate> @end
@implementation AD { UIWindow *_w; }
- (BOOL)application:(UIApplication*)a didFinishLaunchingWithOptions:(NSDictionary*)o {
  L = [NSMutableString string];
  dlopen("/System/Library/PrivateFrameworks/ContactsUICore.framework/ContactsUICore",RTLD_NOW);
  void *ck = dlopen("/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit",RTLD_NOW);
  P(@"chatkit=%s", ck?"ok":"FAIL");

  _w=[[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
  UIViewController *vc=[UIViewController new];
  UIView *root=vc.view;
  const char *env = getenv("GD_STYLE");
  BOOL dark = env && env[0]=='d';
  _w.overrideUserInterfaceStyle = dark ? UIUserInterfaceStyleDark : UIUserInterfaceStyleLight;
  root.backgroundColor = dark ? UIColor.blackColor : UIColor.whiteColor;

  // ---- class constants
  const char *heights[] = {"CKDetailsContactsStandardTableViewCell","CKDetailsAddMemberStandardCell","CKDetailsGroupCountCell","CKDetailsShowMoreContactsCell","CKDetailsSharedWithYouCell","CKDetailsAddGroupNameView",NULL};
  for (int i=0;heights[i];i++) P(@"%s preferredHeight=%.4f", heights[i], clsD(heights[i],"preferredHeight"));

  // ---- 1. group photo (CKAvatarView, Snowglobe) at the measured Ø80 header slot, and Ø60
  [root addSubview:ckAvatar(3,80,CGPointMake(161,62))];
  [root addSubview:ckAvatar(3,60,CGPointMake(20,62))];
  [root addSubview:ckAvatar(2,80,CGPointMake(300,62))];

  // ---- 2. pancake at its two vended widths
  Class PK = objc_getClass("CKDetailsAvatarPancakeView");
  for (int idx=0; idx<2; idx++) {
    int n = idx==0 ? 3 : 2;
    double w = idx==0 ? 72 : 58;
    NSMutableArray *avs=[NSMutableArray array];
    for (int i=0;i<n;i++) [avs addObject:ckAvatar(1,37,CGPointZero)];
    id pv = ((id(*)(id,SEL,CGSize,id))objc_msgSend)([PK alloc], sel_getUid("initWithSize:avatarViews:"), CGSizeMake(w,w), avs);
    UIView *v = (UIView*)pv;
    if (v) { v.frame = CGRectMake(16 + idx*120, 150, w, 41); [root addSubview:v]; [v setNeedsLayout]; [v layoutIfNeeded];
             P(@"\n=== pancake n=%d size=%.0f intrinsic=%.4fx%.4f", n, w, v.intrinsicContentSize.width, v.intrinsicContentSize.height); tree(v,0,v); }
  }

  // ---- 3. real details cells, laid out at the measured 370 cell width
  struct { const char *cls; double h; } cells[] = {
    {"CKDetailsContactsStandardTableViewCell", 64},
    {"CKDetailsAddMemberStandardCell", 44},
    {"CKDetailsGroupCountCell", 22},
    {"CKDetailsShowMoreContactsCell", 44},
    {"CKDetailsGroupNameCell", 90},
    {"CKGroupPhotoCell", 110},
    {NULL,0}
  };
  double y = 210;
  for (int i=0; cells[i].cls; i++) {
    Class c = objc_getClass(cells[i].cls);
    if (!c) { P(@"missing %s", cells[i].cls); continue; }
    double h = clsD(cells[i].cls,"preferredHeight"); if (h <= 0) h = cells[i].h;
    id cell = ((id(*)(id,SEL,long,id))objc_msgSend)([c alloc], sel_getUid("initWithStyle:reuseIdentifier:"), 0, @"x");
    if (!cell) { P(@"alloc failed %s", cells[i].cls); continue; }
    UIView *v = (UIView*)cell;
    if ([cell respondsToSelector:sel_getUid("setEntityName:")]) ((void(*)(id,SEL,id))objc_msgSend)(cell, sel_getUid("setEntityName:"), @"Jamie Aldrich");
    if ([cell respondsToSelector:sel_getUid("setContact:")]) ((void(*)(id,SEL,id))objc_msgSend)(cell, sel_getUid("setContact:"), contacts(1)[0]);
    if ([cell respondsToSelector:sel_getUid("setShowPhoneButton:")]) ((void(*)(id,SEL,BOOL))objc_msgSend)(cell, sel_getUid("setShowPhoneButton:"), YES);
    if ([cell respondsToSelector:sel_getUid("setShowFaceTimeVideoButton:")]) ((void(*)(id,SEL,BOOL))objc_msgSend)(cell, sel_getUid("setShowFaceTimeVideoButton:"), YES);
    if ([cell respondsToSelector:sel_getUid("setGroupName:")]) ((void(*)(id,SEL,id))objc_msgSend)(cell, sel_getUid("setGroupName:"), @"Weekend Crew");
    v.frame = CGRectMake(16, y, 370, h);
    [root addSubview:v];
    [v setNeedsLayout]; [v layoutIfNeeded];
    P(@"\n=== %s at y=%.1f h=%.4f", cells[i].cls, y, h);
    tree(v, 0, v);
    y += h + 10;
  }

  // ---- 4. the group name view on its own (the editable name field)
  Class GN = objc_getClass("CKDetailsAddGroupNameView");
  if (GN) {
    UIView *g = ((id(*)(id,SEL,CGRect))objc_msgSend)([GN alloc], sel_getUid("initWithFrame:"), CGRectMake(16,y,370,44));
    if ([g respondsToSelector:sel_getUid("setGroupName:")]) ((void(*)(id,SEL,id))objc_msgSend)(g, sel_getUid("setGroupName:"), @"Weekend Crew");
    [root addSubview:g]; [g setNeedsLayout]; [g layoutIfNeeded];
    P(@"\n=== CKDetailsAddGroupNameView at y=%.1f sizeThatFits=%.4fx%.4f", y, [g sizeThatFits:CGSizeMake(370,999)].width, [g sizeThatFits:CGSizeMake(370,999)].height);
    tree(g,0,g);
    y += 54;
  }


  // ---- 5. colours, resolved for both interface styles
  {
    Class TH = objc_getClass("CKUITheme");
    id theme = nil;
    for (const char *g : (const char*[]){"sharedTheme","currentTheme","theme",NULL}) {
      if (!g) break;
      SEL s = sel_getUid(g);
      if ([TH respondsToSelector:s]) { theme = ((id(*)(id,SEL))objc_msgSend)(TH, s); if (theme) { P(@"theme via +%s = %s", g, object_getClassName(theme)); break; } }
    }
    const char *sels[] = {"detailsGroupPhotoBackgroundColor","detailsContactCellChevronColor","detailsContactCellTitleColor","detailsAddButtonBackgroundColor","detailsTextColor","detailsSeeAllButtonTextColor",NULL};
    const char *uic[] = {"quaternarySystemFillColor","tertiarySystemFillColor","secondarySystemFillColor","systemFillColor","separatorColor","tertiaryLabelColor","secondaryLabelColor",NULL};
    for (int st=1; st<=2; st++) {
      UITraitCollection *tc = [UITraitCollection traitCollectionWithUserInterfaceStyle:(UIUserInterfaceStyle)st];
      P(@"--- style %d (%s)", st, st==1?"light":"dark");
      for (int i=0; sels[i]; i++) {
        if (!theme || ![theme respondsToSelector:sel_getUid(sels[i])]) { P(@"  %s (absent)", sels[i]); continue; }
        id c = ((id(*)(id,SEL))objc_msgSend)(theme, sel_getUid(sels[i]));
        if (![c isKindOfClass:UIColor.class]) { P(@"  %s = %@", sels[i], c); continue; }
        P(@"  %s = %@", sels[i], colorDesc([(UIColor*)c resolvedColorWithTraitCollection:tc]));
      }
      for (int i=0; uic[i]; i++) {
        id c = ((id(*)(id,SEL))objc_msgSend)(UIColor.class, sel_getUid(uic[i]));
        P(@"  UIColor.%s = %@", uic[i], colorDesc([(UIColor*)c resolvedColorWithTraitCollection:tc]));
      }
    }
  }
  _w.rootViewController=vc; [_w makeKeyAndVisible];

  NSString *docs = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES)[0];
  [L writeToFile:[docs stringByAppendingPathComponent:@"tree.txt"] atomically:YES encoding:NSUTF8StringEncoding error:nil];
  return YES;
}
@end
int main(int c,char**v){@autoreleasepool{ return UIApplicationMain(c,v,nil,NSStringFromClass([AD class])); }}
