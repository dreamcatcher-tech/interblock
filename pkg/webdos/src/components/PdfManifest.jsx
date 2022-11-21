import React from 'react'
import PropTypes from 'prop-types'

import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
  usePDF,
} from '@react-pdf/renderer'

export default function PdfManifest({ complex, Invoice }) {
  const {
    state: { formData },
  } = complex
  console.log('PdfManifest', complex)
  const { runDate, isPublished, isReconciled } = formData

  return (
    <Document title={`Manifest for: ${runDate}`}>
      <Page size="A4" style={styles.body}>
        <Text style={styles.header} fixed>
          Customer: {formData.name}
        </Text>
        <Text style={styles.title}>Invoice</Text>
        <Text style={styles.author}>Company Inc.</Text>
        <Text style={styles.subtitle}>Test Invoice</Text>
        <Text style={styles.text}>Invoice details go here:</Text>
        <Text style={styles.text}>{JSON.stringify(formData, null, 2)}</Text>
      </Page>
    </Document>
  )
}
PdfManifest.propTypes = {
  complex: PropTypes.object.isRequired,
  /**
   * Template to generate the invoices from
   */
  Invoice: PropTypes.func,
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 35,
    paddingBottom: 65,
    paddingHorizontal: 35,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
  },
  author: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 40,
  },
  subtitle: {
    fontSize: 18,
    margin: 12,
  },
  text: {
    margin: 12,
    fontSize: 14,
    textAlign: 'justify',
    fontFamily: 'Times-Roman',
  },
  image: {
    marginVertical: 15,
    marginHorizontal: 100,
  },
  header: {
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
    color: 'grey',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 12,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'grey',
  },
})
