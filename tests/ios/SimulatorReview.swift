import XCTest

final class SimulatorReview: XCTestCase {
    func capture(_ name: String) {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = name
        image.lifetime = .keepAlways
        add(image)
    }
    func named(_ app: XCUIApplication, _ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }
    func testSendAnimationEverywhere() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        func send(_ text: String, _ name: String) {
            XCTAssertTrue(safari.textViews["Message"].firstMatch.waitForExistence(timeout: 10))
            let field = safari.textViews["Message"].firstMatch
            field.tap()
            field.typeText(text)
            capture("\(name)-before-send")
            safari.buttons["Send message"].tap()
            XCTAssertTrue(safari.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch.waitForExistence(timeout: 5))
            capture("\(name)-after-send")
            let keyboardDone = safari.toolbars.buttons["selected"]
            if keyboardDone.exists { keyboardDone.tap() }
        }
        XCTAssertTrue(safari.links["Explore components"].waitForExistence(timeout: 15))
        safari.swipeUp()
        send("Flying from the homepage", "home")
        send("A second message that wraps across several lines before it flies into the conversation.", "home-multiline")
        safari.links["Explore components"].tap()
        send("Flying from the overview", "overview")
        safari.buttons["Open components"].tap()
        safari.links["Composer"].tap()
        send("Flying from the composer", "composer")
        safari.buttons["Open components"].tap()
        safari.links["Conversation list"].tap()
        safari.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Jamie Lee,")).firstMatch.tap()
        send("Flying from a conversation", "conversation")
        safari.webViews.buttons["Back"].firstMatch.tap()
        safari.buttons["New message"].tap()
        let recipient = safari.textFields["To:"].firstMatch
        XCTAssertTrue(recipient.waitForExistence(timeout: 5))
        recipient.tap()
        recipient.typeText("Riley Brooks")
        // Safari's floating address capsule overlaps this small sheet while the recipient
        // keyboard is open. Finish recipient entry before tapping the message field.
        let keyboardDone = safari.toolbars.buttons["selected"]
        if keyboardDone.exists { keyboardDone.tap() }
        send("The first message flies too", "new-conversation")
    }
    func testHomepageInbox() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        XCTAssertTrue(safari.links["Explore components"].waitForExistence(timeout: 15))
        safari.swipeUp()
        let back = safari.webViews.buttons["Back"].firstMatch
        back.tap()
        let freestyle = safari.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Freestyle guy,")).firstMatch
        XCTAssertTrue(freestyle.waitForExistence(timeout: 5))
        capture("home-inbox")
        freestyle.tap()
        XCTAssertTrue(safari.staticTexts["I need more VMs."].waitForExistence(timeout: 5))
        XCTAssertTrue(safari.links.matching(NSPredicate(format: "label CONTAINS %@", "More VMs?")).firstMatch.exists)
        capture("home-freestyle")
        let message = safari.textViews["Message"].firstMatch
        message.tap()
        message.typeText("More VMs from my iPhone.")
        safari.buttons["Send message"].tap()
        XCTAssertTrue(safari.staticTexts["More VMs from my iPhone."].waitForExistence(timeout: 5))
        let keyboardDone = safari.toolbars.buttons["selected"]
        if keyboardDone.exists { keyboardDone.tap() }
        capture("home-freestyle-sent")
        back.tap()
        safari.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Jamie Lee,")).firstMatch.tap()
        XCTAssertTrue(safari.staticTexts["Wait. You went outside?"].waitForExistence(timeout: 5))
        back.tap()
        freestyle.tap()
        XCTAssertTrue(safari.staticTexts["More VMs from my iPhone."].waitForExistence(timeout: 5))
        capture("home-freestyle-retained")
    }
    func testHomepage() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        let explore = safari.links["Explore components"]
        XCTAssertTrue(explore.waitForExistence(timeout: 15), safari.debugDescription)
        XCTAssertTrue(safari.links["Message UI home"].exists)
        capture("home-introduction")
        safari.buttons["Copy prompt for your agent"].tap()
        XCTAssertTrue(safari.buttons["Copied"].waitForExistence(timeout: 5))
        safari.swipeUp()
        let message = safari.textViews["Message"].firstMatch
        XCTAssertTrue(message.waitForExistence(timeout: 5))
        message.tap()
        message.typeText("Hello from the homepage")
        capture("home-keyboard")
        safari.buttons["Send message"].tap()
        XCTAssertTrue(safari.staticTexts["Hello from the homepage"].waitForExistence(timeout: 5))
        let keyboardDone = safari.toolbars.buttons["selected"]
        if keyboardDone.exists { keyboardDone.tap() }
        capture("home-conversation")
        explore.tap()
        XCTAssertTrue(safari.buttons["Customize preview"].waitForExistence(timeout: 5))
        safari.buttons["Open components"].tap()
        safari.links["Home"].tap()
        XCTAssertTrue(explore.waitForExistence(timeout: 5))
    }
    func testCopyAgentPrompt() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        let copy = safari.buttons["Copy prompt for your agent"]
        XCTAssertTrue(copy.waitForExistence(timeout: 15))
        copy.tap()
        XCTAssertTrue(safari.buttons["Copied"].waitForExistence(timeout: 5))
        XCTAssertFalse(safari.buttons["Close agent setup"].exists)
        capture("home-prompt-copied")
        safari.links["Explore components"].tap()
        XCTAssertTrue(copy.waitForExistence(timeout: 5))
        copy.tap()
        XCTAssertTrue(safari.buttons["Copied"].waitForExistence(timeout: 5))
        XCTAssertFalse(safari.buttons["Close agent setup"].exists)
        capture("header-prompt-copied")
    }
    func testExampleHeaders() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        XCTAssertTrue(safari.buttons["Customize preview"].waitForExistence(timeout: 15))
        for component in ["Tapbacks", "Photos", "Typing indicator", "Avatars"] {
            safari.buttons["Open components"].tap()
            if component == "Avatars" {
                let start = safari.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.7))
                let end = safari.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.3))
                start.press(forDuration: 0.05, thenDragTo: end)
            }
            safari.links[component].tap()
            XCTAssertTrue(safari.webViews.staticTexts["9:41"].firstMatch.waitForExistence(timeout: 5))
            XCTAssertTrue(safari.buttons["Jamie Lee, details"].exists)
            capture("header-\(component)")
        }
        safari.buttons["Customize preview"].tap()
        named(safari, "Dark").tap()
        safari.buttons["Customize preview"].tap()
        capture("header-dark")
    }
    func testComponentSearchPopup() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        let search = named(safari, "Search components")
        XCTAssertTrue(search.waitForExistence(timeout: 15), safari.debugDescription)
        search.tap()
        let close = safari.buttons["Close search"]
        XCTAssertTrue(close.waitForExistence(timeout: 5))
        capture("component-search-focused")
        close.tap()
        XCTAssertFalse(close.exists)
        XCTAssertTrue(search.exists)
    }
    func testTypingControls() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        let customize = safari.buttons["Customize preview"]
        XCTAssertTrue(customize.waitForExistence(timeout: 15))
        XCTAssertTrue(safari.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Oh my god.")).firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(safari.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Dad just called")).firstMatch.exists)
        XCTAssertFalse(safari.buttons["Pause animation"].exists)
        capture("typing-preview")
        customize.tap()
        let pause = safari.buttons["Pause animation"]
        let play = safari.buttons["Play animation"]
        XCTAssertTrue(pause.waitForExistence(timeout: 5))
        XCTAssertFalse(safari.staticTexts["Bubble color"].exists)
        pause.tap()
        XCTAssertTrue(play.waitForExistence(timeout: 5))
        capture("typing-paused-controls")
        play.tap()
        XCTAssertTrue(pause.waitForExistence(timeout: 5))
        pause.tap()
        safari.buttons["Reset preview"].tap()
        XCTAssertTrue(pause.waitForExistence(timeout: 5))
        capture("typing-reset-controls")
        customize.tap()
        XCTAssertFalse(pause.exists)
    }
    func testPreviewSizes() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        let customize = safari.buttons["Customize preview"]
        XCTAssertTrue(customize.waitForExistence(timeout: 15))
        for size in ["Compact 375 × 667", "Large 440 × 956"] {
            customize.tap()
            named(safari, size).tap()
            customize.tap()
            let jamie = safari.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Jamie Lee,")).firstMatch
            XCTAssertTrue(jamie.waitForExistence(timeout: 5), safari.debugDescription)
            capture("size-\(size)-list")
            jamie.tap()
            let back = safari.webViews.buttons["Back"].firstMatch
            XCTAssertTrue(back.waitForExistence(timeout: 5))
            capture("size-\(size)-chat")
            back.tap()
        }
        safari.buttons["Reset preview"].tap()
        customize.tap()
        capture("size-controls-reset")
        customize.tap()
    }
    func testConversationNavigation() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        for theme in ["light", "dark"] {
            let jamie = safari.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Jamie Lee,")).firstMatch
            XCTAssertTrue(jamie.waitForExistence(timeout: 15), safari.debugDescription)
            if theme == "dark" {
                safari.buttons["Customize preview"].tap()
                named(safari, "Dark").tap()
                safari.buttons["Customize preview"].tap()
            }
            capture("navigation-\(theme)-list")
            jamie.tap()
            let back = safari.webViews.buttons["Back"].firstMatch
            XCTAssertTrue(back.waitForExistence(timeout: 5), safari.debugDescription)
            XCTAssertTrue(safari.staticTexts["The Dolomites. Italy 🇮🇹"].waitForExistence(timeout: 5))
            capture("navigation-\(theme)-chat")
            back.tap()
            XCTAssertTrue(jamie.waitForExistence(timeout: 5), safari.debugDescription)
            XCTAssertFalse(back.exists)
            capture("navigation-\(theme)-returned")
        }
    }
    func testContactView() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        let alerts = safari.switches["Hide Alerts"]
        if !alerts.exists {
            if safari.buttons["close"].exists { safari.buttons["close"].tap() }
            safari.buttons["Open components"].tap()
            safari.links["Contact view"].tap()
        }
        XCTAssertTrue(alerts.waitForExistence(timeout: 15), safari.debugDescription)
        capture("contact-light")
        alerts.tap()
        XCTAssertEqual(alerts.value as? String, "1")
        safari.webViews.buttons["Back"].firstMatch.tap()
        XCTAssertTrue(safari.buttons["Jamie Lee, details"].waitForExistence(timeout: 5))
        safari.buttons["Customize preview"].tap()
        named(safari, "Dark").tap()
        safari.buttons["Customize preview"].tap()
        // Safari includes the shadow above the pill in its AX bounds. Its visible capsule is
        // at the bottom, like the composer's glass attachment control below.
        let details = safari.buttons["Jamie Lee, details"]
        details.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 1)).withOffset(CGVector(dx: 0, dy: -8)).tap()
        XCTAssertTrue(alerts.waitForExistence(timeout: 5))
        capture("contact-dark")
        safari.webViews.buttons["Back"].firstMatch.tap()
        safari.buttons["Open components"].tap()
        safari.links["Photo viewer"].tap()
    }
    func testConversationList() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        if safari.buttons["close"].exists { safari.buttons["close"].tap() }
        XCTAssertTrue(safari.buttons["Open components"].waitForExistence(timeout: 15), safari.debugDescription)
        safari.buttons["Open components"].tap()
        safari.links["Conversation list"].tap()
        let jamie = safari.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Unread. Jamie Lee,")).firstMatch
        XCTAssertTrue(jamie.waitForExistence(timeout: 10), safari.debugDescription)
        capture("list-01-light")
        jamie.tap()
        XCTAssertTrue(safari.staticTexts["The Dolomites. Italy 🇮🇹"].waitForExistence(timeout: 5), safari.debugDescription)
        safari.webViews.buttons["Back"].firstMatch.tap()
        XCTAssertFalse(jamie.exists)
        safari.buttons["Search"].tap()
        let search = safari.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5), safari.debugDescription)
        search.typeText("COFFEE")
        let result = safari.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Weekend plans,")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 5), safari.debugDescription)
        capture("list-02-search")
        result.tap()
        XCTAssertTrue(safari.staticTexts["Sam: I’ll bring the coffee. Who’s driving?"].waitForExistence(timeout: 5), safari.debugDescription)
        safari.webViews.buttons["Back"].firstMatch.tap()
        let compose = safari.buttons["New message"]
        XCTAssertTrue(compose.waitForExistence(timeout: 5))
        compose.tap()
        let recipient = safari.textFields["To:"].firstMatch
        XCTAssertTrue(recipient.waitForExistence(timeout: 5), safari.debugDescription)
        recipient.tap()
        recipient.typeText("Riley Brooks")
        capture("list-02b-recipient-keyboard")
        let draft = safari.textViews["Message"].firstMatch
        draft.tap()
        draft.typeText("Hello from the conversation list")
        safari.buttons["Send message"].tap()
        let keyboardDone = safari.toolbars.buttons["selected"]
        if keyboardDone.exists { keyboardDone.tap() }
        XCTAssertTrue(safari.staticTexts["Hello from the conversation list"].waitForExistence(timeout: 5), safari.debugDescription)
        capture("list-03-new-thread")
        safari.webViews.buttons["Back"].firstMatch.tap()
        XCTAssertTrue(safari.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Riley Brooks,")).firstMatch.waitForExistence(timeout: 5))
        safari.buttons["Customize preview"].tap()
        named(safari, "Dark").tap()
        safari.buttons["Customize preview"].tap()
        capture("list-04-dark")
        safari.buttons["Reset preview"].tap()
        XCTAssertTrue(jamie.waitForExistence(timeout: 5))
        XCTAssertFalse(safari.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Riley Brooks,")).firstMatch.exists)
        // Leave the default runner ready for the independent photo-viewer journey.
        safari.buttons["Open components"].tap()
        safari.links["Photo viewer"].tap()
    }
    func testNativeAndWebPhotoViewer() throws {
        continueAfterFailure = false
        let native = XCUIApplication(bundleIdentifier: "dev.imessageui.ViewerReference")
        native.launch()
        native.buttons["Open native photos"].tap()
        let canvas = named(native, "Image canvas")
        XCTAssertTrue(canvas.waitForExistence(timeout: 10), native.debugDescription)
        XCTAssertEqual(canvas.frame.width, 402, accuracy: 0.5)
        XCTAssertEqual(canvas.frame.height, 268, accuracy: 0.5)
        XCTAssertEqual(canvas.frame.minY, 303, accuracy: 0.5)
        capture("01-native-fit")
        let center = native.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        center.doubleTap()
        Thread.sleep(forTimeInterval: 0.4)
        capture("02-native-zoom")
        print("NATIVE ZOOM FRAME \(canvas.frame)")
        XCTAssertGreaterThan(canvas.frame.width, 402)
        center.doubleTap()
        Thread.sleep(forTimeInterval: 0.4)
        native.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.5)).press(forDuration: 0.05, thenDragTo: native.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)))
        Thread.sleep(forTimeInterval: 0.4)
        capture("03-native-page")
        let hierarchy = XCTAttachment(string: native.debugDescription)
        hierarchy.name = "Native viewer accessibility"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        native.terminate()

        native.launchArguments = ["--portrait"]
        native.launch()
        native.buttons["Open native photos"].tap()
        let portrait = named(native, "Image canvas")
        XCTAssertTrue(portrait.waitForExistence(timeout: 10))
        print("NATIVE PORTRAIT FIT \(portrait.frame)")
        XCTAssertEqual(portrait.frame.width, 402, accuracy: 0.5)
        XCTAssertEqual(portrait.frame.height, 536, accuracy: 0.5)
        XCTAssertEqual(portrait.frame.minY, 169, accuracy: 0.5)
        capture("03b-native-portrait-fit")
        native.terminate()

        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        let first = named(safari, "Photo, attachment 1 of 3")
        XCTAssertTrue(first.waitForExistence(timeout: 15), safari.debugDescription)
        capture("04-web-open")
        print("WEB GROUP FRAME \(first.frame)")
        let photo = safari.images["A wooden boat on a turquoise alpine lake"].firstMatch
        XCTAssertTrue(photo.exists, safari.debugDescription)
        let fitted = photo.frame
        print("WEB FIT FRAME \(fitted)")
        photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).doubleTap()
        Thread.sleep(forTimeInterval: 0.4)
        capture("05-web-zoom")
        print("WEB ZOOM FRAME \(photo.frame)")
        XCTAssertGreaterThan(photo.frame.width, fitted.width * 2)
        photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).doubleTap()
        Thread.sleep(forTimeInterval: 0.4)
        first.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.5)).press(forDuration: 0.05, thenDragTo: first.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)))
        let second = named(safari, "Photo, attachment 2 of 3")
        XCTAssertTrue(second.waitForExistence(timeout: 5), safari.debugDescription)
        capture("06-web-page")
        second.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.05, thenDragTo: second.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.83)))
        XCTAssertFalse(second.waitForExistence(timeout: 2), safari.debugDescription)
        capture("07-web-dismissed")

        let cases = [("Overview", "Messages"), ("Message bubbles", "Message bubbles"), ("Tapbacks", "Tapbacks"), ("Photos", "Photos"), ("Link previews", "Link previews"), ("Voice messages", "Voice messages"), ("Typing indicator", "Typing indicator"), ("Attachments", "Attachments"), ("Avatars", "Avatar"), ("Date separators", "Date separator"), ("Photo viewer", "Photo viewer"), ("Composer", "Composer")]
        for (i, item) in cases.enumerated() {
            safari.buttons["Open components"].tap()
            XCTAssertFalse(safari.staticTexts["Not affiliated with Apple."].exists)
            safari.links[item.0].tap()
            if item.0 == "Photo viewer" {
                // Safari's modal accessibility tree intentionally hides the registry around it.
                XCTAssertTrue(named(safari, "Photo, attachment 1 of 3").waitForExistence(timeout: 10))
                capture("catalog-\(i)-light")
                safari.buttons["close"].tap()
            }
            XCTAssertTrue(safari.staticTexts[item.1].firstMatch.waitForExistence(timeout: 10), safari.debugDescription)
            XCTAssertTrue(safari.buttons["Reset preview"].waitForExistence(timeout: 5), safari.debugDescription)
            if item.0 != "Photo viewer" { capture("catalog-\(i)-light") }
            safari.buttons["Customize preview"].tap()
            named(safari, "Dark").tap()
            safari.buttons["Customize preview"].tap()
            XCTAssertFalse(named(safari, "Appearance").waitForExistence(timeout: 1))
            if item.0 == "Photo viewer" {
                // Reopen the photo without resetting the selected dark appearance.
                named(safari, "A wooden boat on a turquoise alpine lake").tap()
                XCTAssertTrue(named(safari, "Photo, attachment 1 of 3").waitForExistence(timeout: 5))
            }
            capture("catalog-\(i)-dark")
            if item.0 == "Photo viewer" { safari.buttons["close"].tap() }
        }
        let message = safari.textViews["Message"].firstMatch
        XCTAssertTrue(message.exists)
        message.tap()
        message.typeText("Hello from the simulator")
        let send = safari.buttons["Send message"]
        XCTAssertTrue(send.waitForExistence(timeout: 5))
        send.tap()
        let keyboardDone = safari.toolbars.buttons["selected"]
        if keyboardDone.exists { keyboardDone.tap() }
        XCTAssertFalse(safari.keyboards.firstMatch.waitForExistence(timeout: 1))
        XCTAssertTrue(safari.staticTexts["Hello from the simulator"].waitForExistence(timeout: 5))
        capture("08-composer-sent")
        let add = named(safari, "Add attachment")
        // Safari includes the glass shadow above this control in its AX bounds. Tap the visible
        // bottom disc, not the centre of that inflated accessibility rectangle.
        add.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 1)).withOffset(CGVector(dx: 0, dy: -add.frame.width / 2)).tap()
        let photos = named(safari, "Photos")
        XCTAssertTrue(photos.waitForExistence(timeout: 5), safari.debugDescription)
        photos.tap()
        let attachment = named(safari, "A wooden boat on a turquoise alpine lake")
        XCTAssertTrue(attachment.waitForExistence(timeout: 8))
        attachment.tap()
        XCTAssertTrue(send.waitForExistence(timeout: 5))
        capture("09-photo-selected")
        send.tap()
        XCTAssertTrue(attachment.waitForExistence(timeout: 5))
        XCTAssertFalse(named(safari, "Remove A wooden boat on a turquoise alpine lake").exists)
        capture("10-photo-sent")
    }
}
