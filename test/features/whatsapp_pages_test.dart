import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sgbconnect/app/router/app_router.dart';
import 'package:sgbconnect/features/whatsapp/data/services/quick_replies_storage_service.dart';
import 'package:sgbconnect/features/whatsapp/data/whatsapp_service.dart';
import 'package:sgbconnect/features/whatsapp/domain/models/whatsapp_model.dart';
import 'package:sgbconnect/features/whatsapp/presentation/pages/whatsapp_chat_page.dart';
import 'package:sgbconnect/features/whatsapp/presentation/pages/whatsapp_conversations_page.dart';
import 'package:sgbconnect/features/whatsapp/presentation/widgets/whatsapp_contact_details_sheet.dart';
import 'package:sgbconnect/features/whatsapp/presentation/widgets/whatsapp_message_bubble.dart';
import 'package:sgbconnect/features/whatsapp/presentation/widgets/whatsapp_quick_replies_sheet.dart';
import 'package:sgbconnect/features/whatsapp/presentation/widgets/whatsapp_skeleton_loader.dart';

void main() {
  group('WhatsApp Feature Tests', () {
    testWidgets('WhatsAppConversationsPage renders skeleton loader when loading initial state', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: WhatsAppConversationsPage(initialConversations: null),
        ),
      );
      expect(find.byType(WhatsAppSkeletonList), findsOneWidget);
    });

    testWidgets('WhatsAppConversationsPage renders top bar, filter tabs, and list', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: WhatsAppConversationsPage(
            initialConversations: WhatsAppConversation.sampleConversations(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Top bar
      expect(find.text('WhatsApp CRM'), findsOneWidget);
      expect(find.text('Telecaller Active • Official Meta API'), findsOneWidget);

      // Filter tabs
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Unread'), findsOneWidget);
      expect(find.text('Handoff 🚨'), findsOneWidget);
      expect(find.text('Payments 💳'), findsOneWidget);

      // Conversations rendered from sample data
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Priya Singh'), findsOneWidget);
      expect(find.text('Amit Patel'), findsOneWidget);
    });

    testWidgets('WhatsAppConversationsPage renders 24h badge, read receipts, unread counter, and lead score chips', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: WhatsAppConversationsPage(
            initialConversations: WhatsAppConversation.sampleConversations(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 1. Verify 24h capsule badge
      expect(find.text('24h'), findsWidgets);

      // 2. Verify blue double checkmark
      expect(find.byIcon(Icons.done_all_rounded), findsWidgets);

      // 3. Verify green unread counter
      expect(find.text('2'), findsWidgets);
      expect(find.text('1'), findsWidgets);

      // 4. Verify COLD & WARM category tags
      expect(find.text('COLD'), findsWidgets);
      expect(find.text('WARM'), findsWidgets);

      // 5. Verify assigned telecaller
      expect(find.text('Shaila'), findsWidgets);
    });

    testWidgets('Filtering by Handoff tab displays only handoff conversations', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: WhatsAppConversationsPage(
            initialConversations: WhatsAppConversation.sampleConversations(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'Handoff 🚨'
      await tester.tap(find.text('Handoff 🚨'));
      await tester.pumpAndSettle();

      // Ramesh Kumar is handoff: true
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      // Amit Patel is handoff: false
      expect(find.text('Amit Patel'), findsNothing);
    });

    testWidgets('Filtering by Payments tab displays only payment pending conversations', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: WhatsAppConversationsPage(
            initialConversations: WhatsAppConversation.sampleConversations(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'Payments 💳'
      await tester.tap(find.text('Payments 💳'));
      await tester.pumpAndSettle();

      // Priya Singh is payment pending
      expect(find.text('Priya Singh'), findsOneWidget);
      // Ramesh Kumar is not payment pending
      expect(find.text('Ramesh Kumar'), findsNothing);
    });

    testWidgets('WhatsAppChatPage renders chat screen, messages, and handles send message', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final sample = WhatsAppConversation.sampleConversations().first;

      await tester.pumpWidget(
        MaterialApp(
          onGenerateRoute: AppRouter.generateRoute,
          home: WhatsAppChatPage(conversation: sample),
        ),
      );
      await tester.pumpAndSettle();

      // Header shows customer name and phone
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('+91 98765 43210'), findsOneWidget);

      // Meta 24-hr session window banner
      expect(find.textContaining('24h Customer Window Open'), findsOneWidget);

      // Handoff banner for Ramesh Kumar
      expect(find.textContaining('Human Handoff'), findsOneWidget);
      expect(find.text('Start Chat'), findsOneWidget);

      // Tap 'Start Chat' to resolve handoff
      await tester.tap(find.text('Start Chat'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Handoff resolved'), findsOneWidget);

      // Type and send a message
      final inputField = find.byType(TextField);
      expect(inputField, findsOneWidget);

      await tester.enterText(inputField, 'Namaste Ramesh ji, your tractor tiller is ready for delivery.');
      await tester.pumpAndSettle();

      // Tap send button
      await tester.tap(find.byIcon(Icons.send_rounded), warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(find.text('Namaste Ramesh ji, your tractor tiller is ready for delivery.'), findsOneWidget);
    });

    testWidgets('Payment verification actions inside WhatsAppChatPage', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      // Priya Singh has payment proof pending
      final priyaConv = WhatsAppConversation.sampleConversations().firstWhere((c) => c.isPaymentPending);

      await tester.pumpWidget(
        MaterialApp(
          home: WhatsAppChatPage(conversation: priyaConv),
        ),
      );
      await tester.pumpAndSettle();

      // Payment banner visible
      expect(find.text('UPI Payment screenshot pending review'), findsOneWidget);
      expect(find.text('Verify'), findsOneWidget);

      // Tap 'Verify'
      await tester.tap(find.text('Verify'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Payment verified! Order marked as CONFIRMED'), findsOneWidget);
    });

    testWidgets('Quick Replies Sheet displays empty state when unseeded, and allows adding and selecting reply', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      SharedPreferences.setMockInitialValues({});

      // Pre-add a custom user reply (not mock seeded)
      await QuickRepliesStorageService.addQuickReply(
        const WhatsAppQuickReply(
          id: 'qr_custom_offer',
          shortcut: '/special_offer',
          title: 'Special Harvest Discount',
          body: 'Get 20% discount on organic booster combo this week.',
          category: 'Offers',
          mediaType: 'text',
        ),
      );

      WhatsAppQuickReply? selected;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WhatsAppQuickRepliesSheet(
              onSelectReply: (qr) {
                selected = qr;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Telecaller Quick Replies'), findsOneWidget);
      expect(find.text('/special_offer'), findsOneWidget);
      expect(find.text('Special Harvest Discount'), findsOneWidget);

      // Verify no mock seed replies exist
      expect(find.text('/catalog'), findsNothing);
      expect(find.text('/subsidy'), findsNothing);

      // Tap the custom template
      await tester.tap(find.text('/special_offer'));
      await tester.pumpAndSettle();

      expect(selected, isNotNull);
      expect(selected!.shortcut, equals('/special_offer'));
    });

    testWidgets('Contact Details Sheet displays farmer profile & lead info', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final sample = WhatsAppConversation.sampleConversations().first;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WhatsAppContactDetailsSheet(conversation: sample),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Customer Farm & CRM Details'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Jaipur, Rajasthan'), findsOneWidget);
      expect(find.text('Wheat & Mustard'), findsOneWidget);
      expect(find.text('12 Acres'), findsOneWidget);
    });

    test('QuickRepliesStorageService persists, retrieves, adds, updates, and deletes replies locally without mock seeds', () async {
      SharedPreferences.setMockInitialValues({});

      // 1. First run starts EMPTY - NO MOCK SEEDS!
      final initialReplies = await QuickRepliesStorageService.getQuickReplies();
      expect(initialReplies.isEmpty, isTrue);

      // 2. Add custom video quick reply
      const customVideo = WhatsAppQuickReply(
        id: 'qr_custom_video',
        shortcut: '/tractor_demo',
        title: 'Tractor Harvesting Video',
        body: 'Watch 45HP tractor field demo in Rajasthan.',
        category: 'Field Demo',
        mediaType: 'video',
        mediaUrl: 'https://example.com/tractor_demo.mp4',
        mediaName: 'tractor_demo.mp4',
      );

      final withCustom = await QuickRepliesStorageService.addQuickReply(customVideo);
      expect(withCustom.length, equals(1));
      expect(withCustom.any((r) => r.shortcut == '/tractor_demo'), isTrue);
      final savedVideo = withCustom.firstWhere((r) => r.shortcut == '/tractor_demo');
      expect(savedVideo.mediaType, equals('video'));
      expect(savedVideo.mediaName, equals('tractor_demo.mp4'));
      expect(savedVideo.category, equals('Field Demo'));

      // 3. Update existing quick reply
      final updatedVideo = savedVideo.copyWith(title: 'Updated 45HP Tractor Video');
      final afterUpdate = await QuickRepliesStorageService.updateQuickReply(updatedVideo);
      expect(afterUpdate.firstWhere((r) => r.shortcut == '/tractor_demo').title, equals('Updated 45HP Tractor Video'));

      // 4. Delete quick reply
      final afterDelete = await QuickRepliesStorageService.deleteQuickReply('qr_custom_video');
      expect(afterDelete.isEmpty, isTrue);

      // 5. Reset / clear returns empty list
      final resetReplies = await QuickRepliesStorageService.resetToDefaults();
      expect(resetReplies.isEmpty, isTrue);
    });

    testWidgets('Quick Replies Sheet displays empty state when unseeded and opens editor', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      SharedPreferences.setMockInitialValues({});

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WhatsAppQuickRepliesSheet(
              onSelectReply: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Header & Add Reply button
      expect(find.text('Telecaller Quick Replies'), findsOneWidget);
      expect(find.text('Add Reply'), findsOneWidget);

      // Verify empty state is displayed because no mock replies are seeded
      expect(find.text('No Quick Replies Yet'), findsOneWidget);
      expect(find.text('Add First Quick Reply'), findsOneWidget);

      // Tap 'Add First Quick Reply' button to open editor dialog
      await tester.tap(find.text('Add First Quick Reply'));
      await tester.pumpAndSettle();

      // Verify editor dialog with optional fields
      expect(find.text('Create Quick Reply'), findsOneWidget);
      expect(find.text('Category (Optional)'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Create Template'), findsOneWidget);

      // Verify multi-media picker buttons are present
      expect(find.text('Add Images'), findsOneWidget);
      expect(find.text('Add Video'), findsOneWidget);
      expect(find.text('Photo Camera'), findsOneWidget);
      expect(find.text('Record Video'), findsOneWidget);
      expect(find.text('Files / Doc'), findsOneWidget);

      // Close dialog
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
    });

    testWidgets('WhatsAppChatPage sends custom quick reply with video attachment and displays video card', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      SharedPreferences.setMockInitialValues({});

      // Add a custom video reply
      await QuickRepliesStorageService.addQuickReply(
        const WhatsAppQuickReply(
          id: 'qr_custom_demo',
          shortcut: '/demo_video',
          title: 'Power Tiller Video',
          body: 'Watch 7HP Power Tiller in action across wet fields.',
          category: 'Machinery',
          mediaType: 'video',
          mediaUrl: 'https://example.com/demo.mp4',
          mediaName: 'demo.mp4',
        ),
      );

      final sample = WhatsAppConversation.sampleConversations().first;

      await tester.pumpWidget(
        MaterialApp(
          onGenerateRoute: AppRouter.generateRoute,
          home: WhatsAppChatPage(conversation: sample),
        ),
      );
      await tester.pumpAndSettle();

      // Tap the attachment paperclip icon to open attachment options
      await tester.tap(find.byIcon(Icons.attach_file_rounded));
      await tester.pumpAndSettle();

      // Tap the Quick Replies option
      await tester.tap(find.byIcon(Icons.bolt_rounded));
      await tester.pumpAndSettle();

      // Tap the custom video quick reply (/demo_video)
      expect(find.text('/demo_video'), findsOneWidget);
      await tester.tap(find.text('/demo_video'));
      await tester.pumpAndSettle();

      // Verify video message bubble rendered in chat
      expect(find.text('VIDEO DEMO'), findsOneWidget);
      expect(find.text('MP4'), findsOneWidget);
      expect(find.textContaining('Power Tiller in action'), findsOneWidget);
    });

    test('WhatsAppMessage.fromJson correctly parses reply_to_text and reply_to_sender', () {
      final json = {
        'chat_id': 156106,
        'message': 'Yes, we deliver within 2 days.',
        'direction': 'outgoing',
        'status': 'sent',
        'timestamp': '2026-10-15T19:40:00.000Z',
        'reply_to_chat_id': 156099,
        'reply_to_text': 'Is delivery available to Koppa?',
        'reply_to_sender': 'Customer',
      };

      final msg = WhatsAppMessage.fromJson(json);
      expect(msg.id, '156106');
      expect(msg.text, 'Yes, we deliver within 2 days.');
      expect(msg.replyToId, '156099');
      expect(msg.replyToText, 'Is delivery available to Koppa?');
      expect(msg.replyToSender, 'Customer');
    });

    testWidgets('WhatsAppMessageBubble renders quoted reply card with sender and preview text', (WidgetTester tester) async {
      const msg = WhatsAppMessage(
        id: '156106',
        text: 'Yes, we deliver within 2 days.',
        timestamp: '7:40 PM',
        isOutgoing: true,
        replyToId: '156099',
        replyToText: 'Is delivery available to Koppa?',
        replyToSender: 'Customer',
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WhatsAppMessageBubble(message: msg),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Customer'), findsOneWidget);
      expect(find.text('Is delivery available to Koppa?'), findsOneWidget);
      expect(find.text('Yes, we deliver within 2 days.'), findsOneWidget);
    });

    test('WhatsAppService.resolveMediaUrl correctly resolves relative chats/... paths', () {
      final resolved = WhatsAppService.resolveMediaUrl('chats/1792092796786-6364594854.jpg');
      expect(resolved.contains('/api/media/chats/1792092796786-6364594854.jpg'), isTrue);
    });

    test('WhatsAppMessage.fromJson strips synthetic media text like "Sent a image"', () {
      final json = {
        'id': '156200',
        'chat_id': '156200',
        'message': 'Sent a image',
        'type': 'image',
        'direction': 'inbound',
        'created_at': '2026-10-16T10:00:00Z',
        'media_url': 'chats/test-img.jpg',
      };
      final msg = WhatsAppMessage.fromJson(json);
      expect(msg.text, isEmpty);
      expect(WhatsAppMessage.isSyntheticMediaText('Sent a image'), isTrue);
      expect(WhatsAppMessage.isSyntheticMediaText('Voice note'), isTrue);
      expect(WhatsAppMessage.isSyntheticMediaText('Actual caption from customer'), isFalse);
    });

    testWidgets('WhatsAppMessageBubble does not render "Sent a image" placeholder text', (WidgetTester tester) async {
      const msg = WhatsAppMessage(
        id: '156201',
        text: '', // stripped synthetic text
        timestamp: '10:05 AM',
        isOutgoing: false,
        type: MessageType.image,
        mediaAsset: 'chats/test.jpg',
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WhatsAppMessageBubble(message: msg),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sent a image'), findsNothing);
      expect(find.text('Sent a photo'), findsNothing);
    });
  });
}
