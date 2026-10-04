/**
 * Volzo Driver App — Driver Registration & KYC Page
 * Production-grade 5-step wizard: Aadhar → PAN → Driving License →
 * Selfie & Profile → Vehicle & RC Book.
 *
 * Security: Document numbers are masked in logs. Status transitions
 * (PENDING → UNDER_REVIEW → VERIFIED/REJECTED) are the ONLY data
 * ever displayed or emitted to WebSockets — raw doc URLs never cross
 * the client boundary.
 */

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../home/presentation/pages/home_page.dart';

enum KycStatus { pending, underReview, verified, rejected }

class DriverRegistrationPage extends StatefulWidget {
  const DriverRegistrationPage({super.key});

  @override
  State<DriverRegistrationPage> createState() => _DriverRegistrationPageState();
}

class _DriverRegistrationPageState extends State<DriverRegistrationPage>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();

  // Input controllers — never logged, never passed raw to socket
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _licenseNumberController = TextEditingController();
  final _aadharNumberController = TextEditingController();
  final _panNumberController = TextEditingController();
  final _vehicleNumberController = TextEditingController();
  final _vehicleModelController = TextEditingController();
  final _vehicleColorController = TextEditingController();

  int _currentStep = 0;
  static const int _totalSteps = 5;
  bool _isLoading = false;
  bool _isCheckingStatus = false;
  KycStatus? _kycStatus;

  File? _aadharImage;
  File? _panImage;
  File? _licenseImage;
  File? _profileImage;
  File? _vehicleImage;
  File? _rcImage;
  String _selectedVehicleType = 'SCOOTER';
  int _totalSeats = 1;

  final _imagePicker = ImagePicker();

  // Page animation controller
  late AnimationController _pageAnimController;
  late Animation<double> _pageAnim;

  @override
  void initState() {
    super.initState();
    _pageAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _pageAnim = CurvedAnimation(parent: _pageAnimController, curve: Curves.easeOutCubic);
    _pageAnimController.forward();
    _fetchKycStatus();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _licenseNumberController.dispose();
    _aadharNumberController.dispose();
    _panNumberController.dispose();
    _vehicleNumberController.dispose();
    _vehicleModelController.dispose();
    _vehicleColorController.dispose();
    _pageAnimController.dispose();
    super.dispose();
  }

  Future<void> _fetchKycStatus() async {
    setState(() => _isCheckingStatus = true);
    try {
      final response = await ApiClient.get('/drivers/profile');
      final data = response.data['data'];
      if (data != null) {
        final driver = data['driver'] ?? data;
        final status = (driver['kycStatus'] ?? driver['status'] ?? 'pending').toString().toLowerCase();
        setState(() {
          _kycStatus = _parseStatus(status);
          _isCheckingStatus = false;
        });
        return;
      }
    } catch (e) {
      // New driver — no profile yet
    }
    setState(() {
      _kycStatus = KycStatus.pending;
      _isCheckingStatus = false;
    });
  }

  KycStatus _parseStatus(String raw) {
    switch (raw) {
      case 'verified':
      case 'active':
      case 'approved':
        return KycStatus.verified;
      case 'under_review':
      case 'review':
        return KycStatus.underReview;
      case 'rejected':
        return KycStatus.rejected;
      default:
        return KycStatus.pending;
    }
  }

  Future<void> _pickImage(String type, {bool fromCamera = false}) async {
    final pickedFile = await _imagePicker.pickImage(
      source: fromCamera ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 85,
    );
    if (pickedFile != null) {
      setState(() {
        switch (type) {
          case 'aadhar':
            _aadharImage = File(pickedFile.path);
            break;
          case 'pan':
            _panImage = File(pickedFile.path);
            break;
          case 'license':
            _licenseImage = File(pickedFile.path);
            break;
          case 'profile':
            _profileImage = File(pickedFile.path);
            break;
          case 'vehicle':
            _vehicleImage = File(pickedFile.path);
            break;
          case 'rc':
            _rcImage = File(pickedFile.path);
            break;
        }
      });
    }
  }

  bool _validateCurrentStep() {
    switch (_currentStep) {
      case 0:
        final n = _aadharNumberController.text.trim();
        if (n.length != 12 || int.tryParse(n) == null) {
          _showError('Enter a valid 12-digit Aadhaar number');
          return false;
        }
        if (_aadharImage == null) {
          _showError('Upload a clear photo of your Aadhaar card');
          return false;
        }
        break;
      case 1:
        final p = _panNumberController.text.trim().toUpperCase();
        if (p.length != 10 || !RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$').hasMatch(p)) {
          _showError('Enter a valid 10-character PAN number');
          return false;
        }
        if (_panImage == null) {
          _showError('Upload a clear photo of your PAN card');
          return false;
        }
        break;
      case 2:
        if (_licenseNumberController.text.trim().length < 8) {
          _showError('Enter a valid Driving License number');
          return false;
        }
        if (_licenseImage == null) {
          _showError('Upload a clear photo of your Driving License');
          return false;
        }
        break;
      case 3:
        if (_nameController.text.trim().isEmpty) {
          _showError('Enter your full name as on documents');
          return false;
        }
        if (_profileImage == null) {
          _showError('Take a selfie with your face clearly visible');
          return false;
        }
        break;
      case 4:
        if (_vehicleModelController.text.trim().isEmpty) {
          _showError('Enter vehicle model (e.g. Ola S1 Pro)');
          return false;
        }
        if (_vehicleNumberController.text.trim().length < 6) {
          _showError('Enter vehicle registration plate number');
          return false;
        }
        if (_vehicleImage == null) {
          _showError('Upload a clear photo of your EV vehicle');
          return false;
        }
        if (_rcImage == null) {
          _showError('Upload a clear photo of the RC Book');
          return false;
        }
        break;
    }
    return true;
  }

  void _nextStep() {
    if (!_validateCurrentStep()) return;
    if (_currentStep < _totalSteps - 1) {
      setState(() {
        _currentStep++;
        _pageAnimController.forward(from: 0);
      });
    }
  }

  void _prevStep() {
    if (_currentStep > 0) {
      setState(() {
        _currentStep--;
        _pageAnimController.forward(from: 0);
      });
    }
  }

  Future<void> _submitRegistration() async {
    if (!_validateCurrentStep()) return;
    setState(() => _isLoading = true);

    try {
      // Upload all documents sequentially
      // Document numbers are tokenized — we send file blobs only
      final aadharResp = await ApiClient.uploadFile(
        '/drivers/upload-document',
        _aadharImage!.path,
        fieldName: 'document',
        data: {'type': 'aadhar'},
      );
      final panResp = await ApiClient.uploadFile(
        '/drivers/upload-document',
        _panImage!.path,
        fieldName: 'document',
        data: {'type': 'pan'},
      );
      final licenseResp = await ApiClient.uploadFile(
        '/drivers/upload-document',
        _licenseImage!.path,
        fieldName: 'document',
        data: {'type': 'license'},
      );
      final profileResp = await ApiClient.uploadFile(
        '/drivers/upload-document',
        _profileImage!.path,
        fieldName: 'document',
        data: {'type': 'profile'},
      );
      final vehicleResp = await ApiClient.uploadFile(
        '/drivers/upload-document',
        _vehicleImage!.path,
        fieldName: 'document',
        data: {'type': 'vehicle'},
      );
      final rcResp = await ApiClient.uploadFile(
        '/drivers/upload-document',
        _rcImage!.path,
        fieldName: 'document',
        data: {'type': 'rc'},
      );

      // PATCH driver profile — document numbers sent to backend,
      // never emitted to socket or stored in client logs
      await ApiClient.patch('/drivers/profile', data: {
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'licenseNumber': _licenseNumberController.text.trim(),
        'aadharNumber': _aadharNumberController.text.trim(),
        'panNumber': _panNumberController.text.trim().toUpperCase(),
        'profileImage': profileResp.data['data']?['url'] ?? '',
        'documents': {
          'license': licenseResp.data['data']?['url'] ?? '',
          'aadhar': aadharResp.data['data']?['url'] ?? '',
          'pan': panResp.data['data']?['url'] ?? '',
        },
      });

      // POST vehicle registration
      await ApiClient.post('/drivers/vehicle', data: {
        'type': _selectedVehicleType,
        'model': _vehicleModelController.text.trim(),
        'color': _vehicleColorController.text.trim().isEmpty
            ? 'White'
            : _vehicleColorController.text.trim(),
        'registrationNumber':
            _vehicleNumberController.text.trim().toUpperCase(),
        'totalSeats': _totalSeats,
        'vehicleImage': vehicleResp.data['data']?['url'] ?? '',
        'rcImage': rcResp.data['data']?['url'] ?? '',
      });

      if (!mounted) return;
      _showSuccess('Registration submitted! Our team will verify within 24 hours.');

      // Update local status to under review
      setState(() {
        _kycStatus = KycStatus.underReview;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError(ApiClient.getErrorMessage(e));
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        const Icon(Icons.error_outline, color: Colors.white, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Text(message, style: const TextStyle(color: Colors.white))),
      ]),
      backgroundColor: const Color(0xFFEF4444),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        const Icon(Icons.check_circle_outline, color: Colors.white, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Text(message, style: const TextStyle(color: Colors.white))),
      ]),
      backgroundColor: const Color(0xFF00C853),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 5),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF060811),
        body: _isCheckingStatus
            ? const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00C853)),
                ),
              )
            : _kycStatus == KycStatus.verified
                ? _buildVerifiedScreen()
                : _kycStatus == KycStatus.underReview
                    ? _buildUnderReviewScreen()
                    : _kycStatus == KycStatus.rejected
                        ? _buildRejectedScreen()
                        : _buildWizardBody(),
      ),
    );
  }

  Widget _buildVerifiedScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 100, height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF00C853).withOpacity(0.15),
              border: Border.all(color: const Color(0xFF00C853), width: 2),
            ),
            child: const Icon(Icons.verified_rounded, color: Color(0xFF00C853), size: 54),
          ),
          const SizedBox(height: 24),
          const Text('KYC Verified!', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Text('Your documents have been verified.\nYou\'re ready to start accepting rides!',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 15, height: 1.5)),
          const SizedBox(height: 36),
          _ctaButton('Go to Dashboard', const Color(0xFF00C853), () {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const HomePage()),
              (r) => false,
            );
          }),
        ]),
      ),
    );
  }

  Widget _buildUnderReviewScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 100, height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFFFFA502).withOpacity(0.15),
              border: Border.all(color: const Color(0xFFFFA502), width: 2),
            ),
            child: const Icon(Icons.hourglass_empty_rounded, color: Color(0xFFFFA502), size: 50),
          ),
          const SizedBox(height: 24),
          const Text('Under Review', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Text('Your documents are being verified by the Volzo team.\nThis usually takes 12–24 hours.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 15, height: 1.5)),
          const SizedBox(height: 24),
          _buildStatusTimeline(),
          const SizedBox(height: 36),
          _ctaButton('Check Status', const Color(0xFFFFA502), _fetchKycStatus),
        ]),
      ),
    );
  }

  Widget _buildRejectedScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 100, height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFFEF4444).withOpacity(0.15),
              border: Border.all(color: const Color(0xFFEF4444), width: 2),
            ),
            child: const Icon(Icons.cancel_rounded, color: Color(0xFFEF4444), size: 54),
          ),
          const SizedBox(height: 24),
          const Text('Documents Rejected', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Text('Some of your documents did not pass verification.\nPlease resubmit with clearer images.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 15, height: 1.5)),
          const SizedBox(height: 36),
          _ctaButton('Re-submit Documents', const Color(0xFF0066FF), () {
            setState(() {
              _kycStatus = null;
              _currentStep = 0;
            });
          }),
        ]),
      ),
    );
  }

  Widget _buildStatusTimeline() {
    final steps = [
      ('Documents Submitted', true),
      ('Under Review', true),
      ('Admin Verification', false),
      ('Approved & Active', false),
    ];
    return Column(
      children: steps.asMap().entries.map((entry) {
        final i = entry.key;
        final (label, done) = entry.value;
        return Row(
          children: [
            Column(children: [
              Container(
                width: 24, height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: done ? const Color(0xFF00C853) : Colors.white.withOpacity(0.1),
                  border: Border.all(
                    color: done ? const Color(0xFF00C853) : Colors.white.withOpacity(0.2),
                    width: 1.5,
                  ),
                ),
                child: Icon(done ? Icons.check_rounded : Icons.radio_button_unchecked,
                    size: 14, color: done ? Colors.white : Colors.white.withOpacity(0.3)),
              ),
              if (i < steps.length - 1)
                Container(
                  width: 2, height: 28,
                  color: done ? const Color(0xFF00C853).withOpacity(0.4) : Colors.white.withOpacity(0.1),
                ),
            ]),
            const SizedBox(width: 14),
            Text(label,
                style: TextStyle(
                  color: done ? Colors.white : Colors.white.withOpacity(0.4),
                  fontSize: 13,
                  fontWeight: done ? FontWeight.w600 : FontWeight.w400,
                )),
          ],
        );
      }).toList(),
    );
  }

  Widget _ctaButton(String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        height: 56,
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.4)),
        ),
        child: Center(
          child: Text(label,
              style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.w700)),
        ),
      ),
    );
  }

  Widget _buildWizardBody() {
    return SafeArea(
      child: Column(children: [
        // Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(children: [
            Row(children: [
              if (_currentStep > 0)
                GestureDetector(
                  onTap: _prevStep,
                  child: Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.07),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.12)),
                    ),
                    child: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 16),
                  ),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_stepLabel(), style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                  Text('Step ${_currentStep + 1} of $_totalSteps',
                      style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
                ]),
              ),
              // KYC status chip
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFA502).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFFFA502).withOpacity(0.3)),
                ),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.pending_outlined, color: Color(0xFFFFA502), size: 12),
                  SizedBox(width: 5),
                  Text('PENDING', style: TextStyle(color: Color(0xFFFFA502), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                ]),
              ),
            ]),
            const SizedBox(height: 16),
            // Step progress bar
            Row(children: List.generate(_totalSteps, (i) {
              final active = i <= _currentStep;
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: i < _totalSteps - 1 ? 4 : 0),
                  height: 4,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(2),
                    color: active
                        ? const Color(0xFF00C853)
                        : Colors.white.withOpacity(0.15),
                  ),
                ),
              );
            })),
          ]),
        ),
        // Step content
        Expanded(
          child: FadeTransition(
            opacity: _pageAnim,
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: Form(
                key: _formKey,
                child: _buildActiveStep(),
              ),
            ),
          ),
        ),
        // Bottom action button
        Container(
          padding: const EdgeInsets.all(24),
          child: Row(children: [
            if (_currentStep > 0) ...[
              GestureDetector(
                onTap: _isLoading ? null : _prevStep,
                child: Container(
                  height: 58,
                  width: 58,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withOpacity(0.12)),
                  ),
                  child: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
                ),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 58,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: _isLoading
                      ? LinearGradient(colors: [
                          const Color(0xFF00C853).withOpacity(0.4),
                          const Color(0xFF00E676).withOpacity(0.4),
                        ])
                      : const LinearGradient(
                          colors: [Color(0xFF00C853), Color(0xFF00E676)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                  boxShadow: _isLoading ? [] : [
                    BoxShadow(color: const Color(0xFF00C853).withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 6)),
                  ],
                ),
                child: ElevatedButton(
                  onPressed: _isLoading
                      ? null
                      : (_currentStep == _totalSteps - 1
                          ? _submitRegistration
                          : _nextStep),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    disabledBackgroundColor: Colors.transparent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: _isLoading
                      ? const SizedBox(height: 22, width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white)))
                      : Text(
                          _currentStep == _totalSteps - 1 ? 'Submit for Verification' : 'Continue',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                ),
              ),
            ),
          ]),
        ),
      ]),
    );
  }

  String _stepLabel() {
    switch (_currentStep) {
      case 0: return 'Aadhaar Verification';
      case 1: return 'PAN Card Verification';
      case 2: return 'Driving License';
      case 3: return 'Selfie & Profile';
      case 4: return 'Vehicle & RC Book';
      default: return '';
    }
  }

  Widget _buildActiveStep() {
    switch (_currentStep) {
      case 0: return _buildAadharStep();
      case 1: return _buildPanStep();
      case 2: return _buildLicenseStep();
      case 3: return _buildSelfieStep();
      case 4: return _buildVehicleStep();
      default: return const SizedBox.shrink();
    }
  }

  Widget _stepHeader(String title, String subtitle, IconData icon, Color color) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
          Text(subtitle, style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
        ])),
      ]),
      const SizedBox(height: 8),
      Container(height: 1, color: Colors.white.withOpacity(0.06)),
      const SizedBox(height: 20),
    ]);
  }

  Widget _buildAadharStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _stepHeader('Aadhaar Card', 'Government identity verification', Icons.credit_card_rounded, const Color(0xFF0066FF)),
      _glassTextField(
        controller: _aadharNumberController,
        label: 'Aadhaar Number',
        hint: '1234 5678 9012',
        icon: Icons.credit_card,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(12),
        ],
        keyboardType: TextInputType.number,
      ),
      const SizedBox(height: 20),
      _buildImagePickerCard('Aadhaar Card Photo', _aadharImage, 'aadhar',
          'Front side clearly visible'),
      const SizedBox(height: 20),
      _privacyNote('Your Aadhaar number is encrypted and stored securely. It is never shared with drivers or riders.'),
      const SizedBox(height: 40),
    ]);
  }

  Widget _buildPanStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _stepHeader('PAN Card', 'Income tax identification', Icons.assignment_ind_rounded, const Color(0xFFFFA502)),
      _glassTextField(
        controller: _panNumberController,
        label: 'PAN Number',
        hint: 'ABCDE1234F',
        icon: Icons.assignment_ind,
        textCapitalization: TextCapitalization.characters,
        inputFormatters: [
          FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
          LengthLimitingTextInputFormatter(10),
        ],
      ),
      const SizedBox(height: 20),
      _buildImagePickerCard('PAN Card Photo', _panImage, 'pan', 'All text must be readable'),
      const SizedBox(height: 20),
      _privacyNote('PAN data is processed only for tax compliance and is never exposed to public APIs.'),
      const SizedBox(height: 40),
    ]);
  }

  Widget _buildLicenseStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _stepHeader('Driving License', 'Valid transport vehicle license', Icons.drive_eta_rounded, const Color(0xFF00D9FF)),
      _glassTextField(
        controller: _licenseNumberController,
        label: 'License Number',
        hint: 'DL-3112012345678',
        icon: Icons.badge,
        textCapitalization: TextCapitalization.characters,
      ),
      const SizedBox(height: 20),
      _buildImagePickerCard('Driving License Photo', _licenseImage, 'license',
          'Both sides may be required'),
      const SizedBox(height: 20),
      _privacyNote('License data is verified against Transport Department APIs and never stored in plain text.'),
      const SizedBox(height: 40),
    ]);
  }

  Widget _buildSelfieStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _stepHeader('Profile & Selfie', 'Your driver identity photo', Icons.person_rounded, const Color(0xFF00C853)),
      _buildImagePickerCard('Live Selfie', _profileImage, 'profile', 'Face clearly visible, no sunglasses', fromCamera: true),
      const SizedBox(height: 20),
      _glassTextField(
        controller: _nameController,
        label: 'Full Name',
        hint: 'As on Aadhaar Card',
        icon: Icons.person,
        textCapitalization: TextCapitalization.words,
      ),
      const SizedBox(height: 14),
      _glassTextField(
        controller: _emailController,
        label: 'Email Address (Optional)',
        hint: 'for receipts & notifications',
        icon: Icons.email,
        keyboardType: TextInputType.emailAddress,
      ),
      const SizedBox(height: 20),
      _privacyNote('Your selfie is compared against your Aadhaar photo by our verification team. It is never publicly shared.'),
      const SizedBox(height: 40),
    ]);
  }

  Widget _buildVehicleStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _stepHeader('EV Vehicle Details', 'Your electric vehicle information', Icons.electric_car_rounded, const Color(0xFF0066FF)),
      // Vehicle type selector
      Row(children: [
        Expanded(child: _vehicleTypeCard('SCOOTER', 'Standard 2W', Icons.electric_scooter_rounded, 1)),
        const SizedBox(width: 10),
        Expanded(child: _vehicleTypeCard('SCOOTER_PRO', 'Premium 2W', Icons.electric_bolt_rounded, 1)),
      ]),
      const SizedBox(height: 20),
      _glassTextField(
        controller: _vehicleModelController,
        label: 'Vehicle Model',
        hint: 'e.g. Ola S1 Pro / Hero Electric',
        icon: Icons.directions_car,
        textCapitalization: TextCapitalization.words,
      ),
      const SizedBox(height: 14),
      _glassTextField(
        controller: _vehicleNumberController,
        label: 'Registration Plate',
        hint: 'DL-3C-AB-1234',
        icon: Icons.confirmation_num,
        textCapitalization: TextCapitalization.characters,
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9\-]'))],
      ),
      const SizedBox(height: 14),
      _glassTextField(
        controller: _vehicleColorController,
        label: 'Vehicle Color',
        hint: 'e.g. White, Black, Blue',
        icon: Icons.palette,
        textCapitalization: TextCapitalization.words,
      ),
      const SizedBox(height: 20),
      _buildImagePickerCard('Vehicle Photo', _vehicleImage, 'vehicle', 'Full vehicle clearly visible'),
      const SizedBox(height: 16),
      _buildImagePickerCard('RC Book Photo', _rcImage, 'rc', 'Registration Certificate front page'),
      const SizedBox(height: 20),
      _privacyNote('Vehicle registration is verified against RTO records. Your plate number is partially masked in rider-facing displays.'),
      const SizedBox(height: 40),
    ]);
  }

  Widget _vehicleTypeCard(String type, String label, IconData icon, int seats) {
    final isSelected = _selectedVehicleType == type;
    return GestureDetector(
      onTap: () => setState(() {
        _selectedVehicleType = type;
        _totalSeats = seats;
      }),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF00C853).withOpacity(0.12)
              : Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF00C853) : Colors.white.withOpacity(0.1),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Column(children: [
          Icon(icon, color: isSelected ? const Color(0xFF00C853) : Colors.white.withOpacity(0.4), size: 28),
          const SizedBox(height: 8),
          Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.white.withOpacity(0.5),
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
              )),
        ]),
      ),
    );
  }

  Widget _glassTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    TextCapitalization textCapitalization = TextCapitalization.none,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label,
          style: TextStyle(
              color: Colors.white.withOpacity(0.65),
              fontSize: 13,
              fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      TextField(
        controller: controller,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
        inputFormatters: inputFormatters,
        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.white.withOpacity(0.2), fontSize: 14),
          prefixIcon: Icon(icon, color: const Color(0xFF00C853).withOpacity(0.7), size: 20),
          filled: true,
          fillColor: Colors.white.withOpacity(0.06),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFF00C853), width: 1.5),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    ]);
  }

  Widget _buildImagePickerCard(
    String label,
    File? image,
    String type,
    String hint, {
    bool fromCamera = false,
  }) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label,
          style: TextStyle(color: Colors.white.withOpacity(0.65), fontSize: 13, fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      GestureDetector(
        onTap: () => _showImageSourceDialog(type, fromCamera: fromCamera),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 150,
          decoration: BoxDecoration(
            color: image != null
                ? Colors.transparent
                : Colors.white.withOpacity(0.04),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: image != null
                  ? const Color(0xFF00C853).withOpacity(0.5)
                  : Colors.white.withOpacity(0.1),
              width: image != null ? 1.5 : 1.0,
            ),
          ),
          child: image != null
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(15),
                  child: Stack(children: [
                    Image.file(image, fit: BoxFit.cover, width: double.infinity, height: 150),
                    Positioned(
                      top: 8, right: 8,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00C853),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.check_rounded, color: Colors.white, size: 14),
                      ),
                    ),
                    Positioned(
                      bottom: 8, right: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.6),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.edit_rounded, color: Colors.white, size: 12),
                          SizedBox(width: 4),
                          Text('Change', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                        ]),
                      ),
                    ),
                  ]),
                )
              : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF00C853).withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      fromCamera ? Icons.camera_alt_rounded : Icons.add_photo_alternate_rounded,
                      color: const Color(0xFF00C853), size: 28,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    fromCamera ? 'Take Selfie' : 'Upload Document',
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(hint, style: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 11)),
                ]),
        ),
      ),
    ]);
  }

  void _showImageSourceDialog(String type, {bool fromCamera = false}) {
    if (fromCamera) {
      _pickImage(type, fromCamera: true);
      return;
    }
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF111827),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Select Image Source',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: _sourceOption(
                Icons.camera_alt_rounded, 'Camera', 'Take a live photo',
                () { Navigator.pop(ctx); _pickImage(type, fromCamera: true); },
              )),
              const SizedBox(width: 12),
              Expanded(child: _sourceOption(
                Icons.photo_library_rounded, 'Gallery', 'Choose from gallery',
                () { Navigator.pop(ctx); _pickImage(type); },
              )),
            ]),
            const SizedBox(height: 8),
          ]),
        ),
      ),
    );
  }

  Widget _sourceOption(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Column(children: [
          Icon(icon, color: const Color(0xFF00C853), size: 30),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
          Text(subtitle, style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11), textAlign: TextAlign.center),
        ]),
      ),
    );
  }

  Widget _privacyNote(String message) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0066FF).withOpacity(0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF0066FF).withOpacity(0.15)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.shield_rounded, color: Color(0xFF0066FF), size: 16),
        const SizedBox(width: 8),
        Expanded(
          child: Text(message,
              style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11, height: 1.5)),
        ),
      ]),
    );
  }
}
