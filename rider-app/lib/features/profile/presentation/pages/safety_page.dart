import 'package:flutter/material.dart';
import '../../../../core/config/theme_config.dart';

class SafetyPage extends StatefulWidget {
  const SafetyPage({super.key});

  @override
  State<SafetyPage> createState() => _SafetyPageState();
}

class _SafetyPageState extends State<SafetyPage> with SingleTickerProviderStateMixin {
  bool _shareTripAuto = true;
  bool _isSosTriggered = false;
  int _sosCountdown = 5;
  AnimationController? _pulseController;

  final List<Map<String, String>> _emergencyContacts = [
    {'name': 'Dad (Primary)', 'phone': '+91 98765 43210'},
    {'name': 'Sarah (Spouse)', 'phone': '+91 87654 32109'},
  ];

  final _contactNameController = TextEditingController();
  final _contactPhoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
      lowerBound: 0.85,
      upperBound: 1.0,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController?.dispose();
    _contactNameController.dispose();
    _contactPhoneController.dispose();
    super.dispose();
  }

  void _triggerSos() {
    setState(() {
      _isSosTriggered = true;
      _sosCountdown = 5;
    });

    _runSosCountdown();
  }

  void _runSosCountdown() {
    Future.delayed(const Duration(seconds: 1), () {
      if (!mounted || !_isSosTriggered) return;

      if (_sosCountdown > 1) {
        setState(() {
          _sosCountdown--;
        });
        _runSosCountdown();
      } else {
        setState(() {
          _isSosTriggered = false;
        });
        _dispatchSosAlert();
      }
    });
  }

  void _cancelSos() {
    setState(() {
      _isSosTriggered = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Emergency SOS alert cancelled safely.'),
        backgroundColor: Colors.amber,
      ),
    );
  }

  void _dispatchSosAlert() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: ThemeConfig.errorColor, size: 28),
            SizedBox(width: 10),
            Text('SOS Alert Dispatched!', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Your location coordinates and active ride details have been securely sent to:',
              style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: ThemeConfig.errorColor.withOpacity(0.08),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: _emergencyContacts.map((c) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        const Icon(Icons.check, color: ThemeConfig.errorColor, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          '${c['name']} (${c['phone']})',
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  );
                }).toList()
                  ..add(
                    const Padding(
                      padding: EdgeInsets.only(bottom: 0),
                      child: Row(
                        children: [
                          Icon(Icons.check, color: ThemeConfig.errorColor, size: 16),
                          SizedBox(width: 8),
                          Text('Volzo EV Support & GPS Terminal', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'A support representative is dialing you immediately to assist.',
              style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 12),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(backgroundColor: ThemeConfig.errorColor),
            child: const Text('Acknowledge'),
          ),
        ],
      ),
    );
  }

  void _addEmergencyContact() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: ThemeConfig.surfaceColor,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 24,
          right: 24,
          top: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Add Trusted Contact',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _contactNameController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Contact Name',
                labelStyle: TextStyle(color: ThemeConfig.textSecondaryColor),
                filled: true,
                fillColor: Color(0xFF242424),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _contactPhoneController,
              keyboardType: TextInputType.phone,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Phone Number',
                labelStyle: TextStyle(color: ThemeConfig.textSecondaryColor),
                filled: true,
                fillColor: Color(0xFF242424),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                final name = _contactNameController.text.trim();
                final phone = _contactPhoneController.text.trim();
                if (name.isEmpty || phone.isEmpty) return;

                setState(() {
                  _emergencyContacts.add({'name': name, 'phone': phone});
                });

                _contactNameController.clear();
                _contactPhoneController.clear();
                Navigator.pop(context);

                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('$name added to Trusted Contacts!'),
                    backgroundColor: ThemeConfig.successColor,
                  ),
                );
              },
              child: const Text('Add Contact'),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      appBar: AppBar(
        title: const Text('Safety & SOS Center', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // SOS Trigger Section
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: ThemeConfig.surfaceColor,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: ThemeConfig.errorColor.withOpacity(0.15)),
              ),
              child: Column(
                children: [
                  const Text(
                    'EMERGENCY SOS SYSTEM',
                    style: TextStyle(color: ThemeConfig.errorColor, fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 1.5),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'In case of emergency, press the button below. It will immediately trigger a dispatch event.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 12, height: 1.4),
                  ),
                  const SizedBox(height: 28),

                  // Giant Red Pulsing Emergency Button
                  _isSosTriggered
                      ? GestureDetector(
                          onTap: _cancelSos,
                          child: Container(
                            width: 140,
                            height: 140,
                            decoration: const BoxDecoration(
                              color: Colors.amber,
                              shape: BoxShape.circle,
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  '$_sosCountdown',
                                  style: const TextStyle(color: Colors.black, fontSize: 44, fontWeight: FontWeight.w900),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  'TAP TO CANCEL',
                                  style: TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                        )
                      : AnimatedBuilder(
                          animation: _pulseController!,
                          builder: (context, child) => Transform.scale(
                            scale: _pulseController!.value,
                            child: child,
                          ),
                          child: InkWell(
                            onTap: _triggerSos,
                            customBorder: const CircleBorder(),
                            child: Container(
                              width: 140,
                              height: 140,
                              decoration: BoxDecoration(
                                color: ThemeConfig.errorColor,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: ThemeConfig.errorColor.withOpacity(0.4),
                                    blurRadius: 20,
                                    spreadRadius: 4,
                                  ),
                                ],
                              ),
                              child: const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.gpp_bad, color: Colors.white, size: 42),
                                  SizedBox(height: 6),
                                  Text(
                                    'TRIGGER SOS',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Share Trip Settings
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: ThemeConfig.surfaceColor,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withOpacity(0.04)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.share_location, color: ThemeConfig.primaryColor, size: 24),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Auto-Share Live Ride Status',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Share real-time tracking links automatically.',
                          style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _shareTripAuto,
                    activeColor: ThemeConfig.primaryColor,
                    onChanged: (val) {
                      setState(() => _shareTripAuto = val);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Trusted Contacts Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'TRUSTED EMERGENCY CONTACTS',
                  style: TextStyle(
                    color: ThemeConfig.textTertiaryColor,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                  ),
                ),
                TextButton.icon(
                  onPressed: _addEmergencyContact,
                  icon: const Icon(Icons.add, size: 14),
                  label: const Text('Add New', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  style: TextButton.styleFrom(foregroundColor: ThemeConfig.primaryColor),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Emergency Contacts list
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _emergencyContacts.length,
              itemBuilder: (context, index) {
                final c = _emergencyContacts[index];

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: ThemeConfig.surfaceColor,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: Colors.white.withOpacity(0.04)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: const BoxDecoration(
                          color: Color(0xFF242424),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.person, color: Colors.white70, size: 20),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              c['name']!,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              c['phone']!,
                              style: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () {
                          setState(() {
                            _emergencyContacts.removeAt(index);
                          });
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Contact removed.'),
                              backgroundColor: Colors.grey,
                            ),
                          );
                        },
                        icon: const Icon(Icons.delete_outline, color: ThemeConfig.errorColor, size: 20),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 28),

            // In-app Emergency Helpline directory
            const Text(
              'EMERGENCY SUPPORT NUMBERS',
              style: TextStyle(
                color: ThemeConfig.textTertiaryColor,
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 16),

            _buildHelplineCard('Volzo 24/7 Incident Helpline', '1800-VOLZO-SOS', Icons.phone_in_talk),
            const SizedBox(height: 12),
            _buildHelplineCard('Police Response Terminal', '112 / 100', Icons.local_police),
            const SizedBox(height: 12),
            _buildHelplineCard('Medical Emergency / Ambulance', '102', Icons.local_hospital),
          ],
        ),
      ),
    );
  }

  Widget _buildHelplineCard(String title, String num, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Row(
        children: [
          Icon(icon, color: ThemeConfig.primaryColor, size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                ),
                const SizedBox(height: 2),
                Text(
                  num,
                  style: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.call, color: ThemeConfig.successColor, size: 20),
            style: IconButton.styleFrom(backgroundColor: const Color(0xFF242424)),
          ),
        ],
      ),
    );
  }
}
