import moment from 'moment'

export const getFormattedTime = timestamp => moment(timestamp * 1000).format('MMM D YYYY HH:mm:ss')
