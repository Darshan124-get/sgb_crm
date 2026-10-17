import 'package:flutter/material.dart';

class DashboardBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTabSelected;
  final VoidCallback onCallPressed;

  const DashboardBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTabSelected,
    required this.onCallPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(
                index: 0,
                icon: Icons.home_rounded,
                label: 'Home',
              ),
              _buildNavItem(
                index: 1,
                icon: Icons.people_outline_rounded,
                label: 'Leads',
              ),

              // Floating Center Action Button (Calls)
              GestureDetector(
                onTap: onCallPressed,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0A5844), Color(0xFF064736)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0A5844).withValues(alpha: 0.4),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.phone_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Calls',
                      style: TextStyle(
                        color: Color(0xFF0A5844),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),

              _buildNavItem(
                index: 2,
                icon: Icons.inventory_2_outlined,
                label: 'Orders',
              ),
              _buildNavItem(
                index: 3,
                icon: Icons.chat_bubble_rounded,
                label: 'WhatsApp',
                isWhatsApp: true,
              ),
              _buildNavItem(
                index: 4,
                icon: Icons.grid_view_rounded,
                label: 'More',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required String label,
    bool isWhatsApp = false,
  }) {
    final isSelected = currentIndex == index;
    const activeColor = Color(0xFF0A5844);
    const inactiveColor = Color(0xFF94A3B8);
    final itemColor = isSelected ? (isWhatsApp ? const Color(0xFF25D366) : activeColor) : inactiveColor;

    return GestureDetector(
      onTap: () => onTabSelected(index),
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isWhatsApp)
              Stack(
                alignment: Alignment.center,
                children: [
                  Icon(
                    Icons.chat_bubble_rounded,
                    size: 22,
                    color: itemColor,
                  ),
                  const Positioned(
                    top: 5,
                    left: 5.5,
                    child: Icon(
                      Icons.phone_rounded,
                      size: 9.5,
                      color: Colors.white,
                    ),
                  ),
                ],
              )
            else
              Icon(
                icon,
                size: 22,
                color: itemColor,
              ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: itemColor,
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
