import moment from 'moment'

export const getFormattedTime = timestamp => moment(timestamp * 1000).format('D MMM YYYY : HH-mm-ss')
