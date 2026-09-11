import 'package:intl/intl.dart';

class CurrencyFormatter {
  static String formatGhs(int amountCents) {
    final double cedis = amountCents / 100.0;
    final formatter = NumberFormat.currency(
      symbol: "GH₵ ",
      decimalDigits: 2,
    );
    return formatter.format(cedis);
  }

  static String formatGhsCompact(int amountCents) {
    final double cedis = amountCents / 100.0;
    return "GH₵ ${cedis.toStringAsFixed(cedis.truncateToDouble() == cedis ? 0 : 2)}";
  }
}
