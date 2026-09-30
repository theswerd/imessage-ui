#import <UIKit/UIKit.h>
#import <QuickLook/QuickLook.h>
#import <objc/runtime.h>
#import <dlfcn.h>

@interface ViewerHost : UIViewController <QLPreviewControllerDataSource>
@property NSArray<NSURL *> *photos;
@end
@implementation ViewerHost
- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = UIColor.blackColor;
    self.photos = @[[NSBundle.mainBundle URLForResource:@"lake" withExtension:@"jpg"], [NSBundle.mainBundle URLForResource:@"cabin" withExtension:@"jpg"], [NSBundle.mainBundle URLForResource:@"mountain" withExtension:@"jpg"]];
    if ([NSProcessInfo.processInfo.arguments containsObject:@"--portrait"]) self.photos = @[[NSBundle.mainBundle URLForResource:@"viewer-probe" withExtension:@"jpg"]];
    UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
    [button setTitle:@"Open native photos" forState:UIControlStateNormal];
    button.frame = CGRectMake(60, 350, 282, 60);
    [button addTarget:self action:@selector(openViewer) forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:button];
}
- (void)openViewer {
    dlopen("/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit", RTLD_NOW);
    Class cls = objc_getClass("CKQLPreviewController");
    NSAssert(cls, @"The native Messages QuickLook controller must exist");
    QLPreviewController *viewer = [cls new];
    viewer.dataSource = self;
    viewer.modalPresentationStyle = UIModalPresentationFullScreen;
    [self presentViewController:viewer animated:NO completion:^{
        NSLog(@"REFERENCE controller=%@ frame=%@ safeArea=%@", NSStringFromClass(viewer.class), NSStringFromCGRect(viewer.view.bounds), NSStringFromUIEdgeInsets(viewer.view.safeAreaInsets));
    }];
}
- (NSInteger)numberOfPreviewItemsInPreviewController:(QLPreviewController *)controller { return self.photos.count; }
- (id<QLPreviewItem>)previewController:(QLPreviewController *)controller previewItemAtIndex:(NSInteger)index { return self.photos[index]; }
@end
@interface ViewerApp : UIResponder <UIApplicationDelegate>
@property (nonatomic) UIWindow *window;
@end
@implementation ViewerApp
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)options {
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    self.window.rootViewController = [ViewerHost new];
    [self.window makeKeyAndVisible];
    return YES;
}
@end
int main(int argc, char *argv[]) { @autoreleasepool { return UIApplicationMain(argc, argv, nil, @"ViewerApp"); } }
